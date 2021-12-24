const udp = require("dgram");
import { Subject } from "rxjs";

class ConnectorBridgeService {
    private static instance: ConnectorBridgeService;
    private host: string;
    private port: number;
    private accessToken: string;
    private client: any;
    private _messageSubject: any;
    get messageSubject() {
        return this._messageSubject;
    }

    constructor(host: string, port: number, accessToken: string) {
        this.host = host;
        this.port = port;
        this.accessToken = accessToken;
        this.client = udp.createSocket("udp4");
        this._messageSubject = new Subject();

        this.client.on("message", (msg, info) => {
            this._messageSubject.next(JSON.parse(msg));
        });
    }
    static get(host?: string, port?: number, accessToken?: string) {
        if (!ConnectorBridgeService.instance) {
            if (!host || !port || !accessToken) {
                throw Error("Cannot create ConnectorBridgeService");
            }
            ConnectorBridgeService.instance = new ConnectorBridgeService(host, port, accessToken);
        }
        return ConnectorBridgeService.instance;
    }

    sendMessage(message: any): Promise<void> {
        message.msgId = new Date().getTime();
        message["AccessToken"] = this.accessToken;
        return new Promise((resolve, reject) => {
            this.client.send(JSON.stringify(message), this.port, this.host, (error) => {
                if (error) {
                    console.error(error);
                    this.client.close();
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

export { ConnectorBridgeService };
