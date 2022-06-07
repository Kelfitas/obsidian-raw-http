import tls from 'tls';
import http from 'http';
import https from 'https';

tls.DEFAULT_MIN_VERSION = 'TLSv1';
tls.DEFAULT_MAX_VERSION = 'TLSv1.3';
const MAX_WAIT = 1000 * 30;

const Request = function(req) {
    this._rawRequest = req;
    this.separator = '\r\n';
    if (this._rawRequest.indexOf(this.separator) === -1) {
        this._rawRequest = this._rawRequest.replace(/\n/g, this.separator);
    }
    this.parse();
};

Request.prototype.parse = function() {
    const [rawHeaders, body] = this._rawRequest.split(this.separator + this.separator);
    this.body = body;

    const headerLines = rawHeaders.split(this.separator);
    const statusLine = headerLines.shift();

    const status = statusLine.split(' ');
    this.method = status[0];
    this.uri = status[1];
    this.proto = status[2];

    this.headers = {};
    for (let headerLine of headerLines) {
        const [key, value] = headerLine.split(': ');
        this.headers[key] = value;
    }
};

Request.prototype.dump = function() {
    return [
        `${this.method} ${this.uri} ${this.proto}`,
        `${this.getRawHeaders()}`,
        ``,
        `${this.body}`,
      ].join(this.separator);
};


Request.prototype.getRawHeaders = function() {
    return objToRawHeaders(this.headers);
}

const Response = function(req) {
    this._rawResponse = req;
    this.separator = '\r\n';
    if (this._rawResponse.indexOf(this.separator) === -1) {
        this._rawResponse = this._rawResponse.replace(/\n/g, this.separator);
    }
    this.parse();
};

Response.prototype.parse = function() {
    const [rawHeaders, body] = this._rawResponse.split(this.separator + this.separator);
    this.body = body;

    const headerLines = rawHeaders.split(this.separator);
    const statusLine = headerLines.shift();

    const status = statusLine.split(' ');
    this.proto = status[0];
    this.statusCode = status[1];
    this.statusMessage = status[2];

    this.headers = {};
    for (let headerLine of headerLines) {
        const [key, value] = headerLine.split(': ');
        this.headers[key] = value;
    }
};

Response.prototype.dump = function() {
    return [
        `${this.proto} ${this.statusCode} ${this.statusMessage}`,
        `${this.getRawHeaders()}`,
        ``,
        `${this.body}`,
      ].join(this.separator);
};


Response.prototype.getRawHeaders = function() {
    return objToRawHeaders(this.headers);
}

const objToRawHeaders = (headersObj) => {
    let headers = [];
    for (let key in headersObj) {
        const value = headersObj[key];
        headers.push(`${key}: ${value}`);
    }

    return headers.join('\r\n');
};

export const formatRequest = (req) => {
    const request = new Request(req);

    request.body = request.body.replace(/\r/g, '').replace(/\n/g, '').replace(/\t/g, '');
    const len = Buffer.byteLength(request.body);
    request.headers['Content-Length'] = len;

    return request;
}

// request has to be formatted with formatRequest func.
export const makeRequest = async (c, request) => {
    return new Promise((resolve, reject) => {
        let body = '';
        let rawResponse = '';
        let response;
        let to;
        let i = 0;
        const parseRawResponse = (data) => {
            rawResponse += data.toString();
            response = new Response(rawResponse);
            if (response.statusCode) {
                parseResponseBody(data, response);
            }
            i++;
        };
        const parseResponseBody = (data, response) => {
            body += data.toString();
            const contentLength = parseInt(response.headers['content-length'], 10) || 0;
            if (contentLength <= body.length) {
                rawResponse = rawResponse || [
                    `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`,
                    objToRawHeaders(response.headers),
                    '',
                    body
                ].join('\r\n');
                response.raw = rawResponse;
                resolve(response);
                clearTimeout(to);
            }
        };

        let options = {
            hostname: c.host,
            port: c.port,
            path: request.uri,
            headers: request.headers,
            method: request.method,
            protocol: c.isSSL ? 'https:' : 'http:',
            rejectUnauthorized: false,
        };

        if (c.proxyConfig.useProxy) {
            options = {
                ...options,
                port: c.proxyConfig.port,
                host: c.proxyConfig.host,
                hostname: c.proxyConfig.host,
                method: 'CONNECT',
                path: `${c.host}:${c.port}`,
                protocol: 'http:',
            }
        }

        const httpReq = (c.proxyConfig.useProxy ? http : https).request(options, (res) => {
            if (c.proxyConfig.useProxy) return;
            res.on('data', data => parseResponseBody(data, res));
        });

        httpReq.on('error', reject);
        if (!c.proxyConfig.useProxy) {
            httpReq.write(request.body);
        }
        httpReq.end();

        if (c.proxyConfig.useProxy) {
            httpReq.on('connect', (res, socket, head) => {
                console.log('got connected! proxy response:', res);

                if (c.isSSL) {
                    const tlsConnection = tls.connect({
                        host: c.host,
                        servername: c.host,
                        socket,
                        rejectUnauthorized: false,
                    }, () => {
                        tlsConnection.write(request.dump());
                    });
                    tlsConnection.on('data', parseRawResponse);
                } else {
                    socket.write(request.dump());
                    socket.on('data', parseRawResponse);
                }
            });
        }

        to = setTimeout(() => {
            reject('timedout');
        }, MAX_WAIT);
    });
};