import * as express from "express";
import { ExchangeChannel, ExchangeChannelConfig, Subscription, ExchangeChannelManager } from "./ExchangeChannel";

export default class ObjectExchangeServer {

    private _router: express.Router;
    public get router(): express.Router {
        return this._router;
    }

    private exchangeChannels: ExchangeChannelManager = new ExchangeChannelManager();

    constructor() {
        let router = this._router = express.Router();
        router.use(express.urlencoded());
        router.use(this.middleware.bind(this));
        router.post("/", this.createChannel.bind(this));
        router.post("/:channelId", this.subscribe.bind(this));
        router.put("/:channelId", this.publish.bind(this));
        router.get("/:channelId", this.poll.bind(this));
    }

    private middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
        let _req = req as ExchangeRequest
        _req.subscriberId = req.get("X-SubscriberId");

        if (req.method == "PUT" && !req.complete) {
            let body: Uint8Array[] = [];

            req.on('data', function (chunk) {
                body.push(chunk);
            })
                .on('end', function () {
                    _req.rawBody = Buffer.concat(body);
                    next();
                });
        } else {
            next();
        }
    }

    private poll(req: express.Request, res: express.Response, next: express.NextFunction) {
        let channel = this.exchangeChannels.get(req.params.channelId);
        let _req = req as ExchangeRequest;
        if (channel) {
            if (_req.subscriberId) {
                if (channel.hasSubscriber(_req.subscriberId)) {
                    channel.subscribe(new Subscription(_req.subscriberId, req, res));
                } else {
                    res.status(401).send({ status: 401 });
                }
            } else {
                res.status(404).send({ status: 404 });
            }
        } else {
            res.status(404).send({ status: 404 });
        }
    }

    private createChannel(req: express.Request, res: express.Response, next: express.NextFunction) {
        let config = req.body as ExchangeChannelConfig;
        if (!(config && config.channelId && config.question && config.answer)) {
            res.status(400).send({ status: 400 });
        } else {
            if (!this.exchangeChannels.has(config.channelId)) {
                let channel = new ExchangeChannel({
                    channelId: config.channelId,
                    question: config.question,
                    answer: config.answer
                });

                this.exchangeChannels.add(channel);

                let subscriber = channel.createSubscriber()

                res.send({ status: 200, subscriberId: subscriber.subscriberId });
            } else {
                res.status(409).send({ status: 409 });
            }
        }
    }

    private subscribe(req: express.Request, res: express.Response, next: express.NextFunction) {
        let channel = this.exchangeChannels.get(req.params.channelId);
        if (channel) {
            let verify = req.body as ExchangeChannelVerify;
            if (verify.answer) {
                if (channel.isAnwser(verify.answer)) {
                    let subscriber = channel.createSubscriber();
                    res.send({ status: 200, subscriberId: subscriber.subscriberId });
                } else {
                    res.status(401).send({ status: 401 });
                }
            } else {
                res.send({ status: 200, question: channel.question });
            }
        } else {
            res.status(404).send({ status: 404 });
        }
    }

    private publish(req: express.Request, res: express.Response, next: express.NextFunction) {
        let channel = this.exchangeChannels.get(req.params.channelId);
        let _req = req as ExchangeRequest;
        if (channel) {
            channel.publish(_req.subscriberId, _req.rawBody);
            res.send({ status: 200 });
        } else {
            res.status(404).send({ status: 404 });
        }
    }
}

interface ExchangeRequest extends express.Request {
    rawBody: Buffer,
    subscriberId: string,
}

interface ExchangeChannelVerify {
    answer: string,
}