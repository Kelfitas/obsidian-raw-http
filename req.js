import tls from 'tls';
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
    return objToRawHeaders(headers);
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
        let to;
        const appendBody = (data, response) => {
            body += data.toString();
            const contentLength = parseInt(response.headers['content-length'], 10) || 0;
            if (contentLength <= body.length) {
                clearTimeout(to);
                const rawResponse = [
                    `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`,
                    objToRawHeaders(response.headers),
                    '',
                    body
                ].join('\r\n');
                response.raw = rawResponse;
                resolve(response);
            }
        };

        const options = {
            hostname: c.host,
            port: c.port,
            path: request.uri,
            headers: request.headers,
            method: request.method,
            protocol: c.isSSL ? 'https:' : 'http:',
            rejectUnauthorized: false,
        };

        const httpReq = https.request(options, (res) => {
            res.on('data', data => appendBody(data, res));
        });

        httpReq.on('error', reject);
        httpReq.write(request.body);
        httpReq.end();
        to = setTimeout(() => {
            reject('timedout');
        }, MAX_WAIT);
    });
};