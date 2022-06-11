export const objToRawHeaders = (headersObj) => {
    let headers = [];
    for (let key in headersObj) {
        const value = headersObj[key];
        headers.push(`${key}: ${value}`);
    }

    return headers.join('\r\n');
};

export const Request = function(req) {
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

export const Response = function(req) {
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