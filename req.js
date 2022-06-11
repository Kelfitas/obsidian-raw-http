import tls from 'tls';
import http from 'http';
import https from 'https';
import { objToRawHeaders, Request, Response } from './http';

tls.DEFAULT_MIN_VERSION = 'TLSv1';
tls.DEFAULT_MAX_VERSION = 'TLSv1.3';
const MAX_WAIT = 1000 * 30;

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