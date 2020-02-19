import * as uuid from "uuid/v4";
import * as express from "express";

export class ExchangeChannelManager {

    private channels: { [key: string]: ExchangeChannel } = {}

    constructor() {
        setInterval(() => {
            for (const i in this.channels) {
                this.channels[i].cleanUp();
                if (!this.channels[i].hasSubscribers()) {
                    delete this.channels[i];
                }
            }
        }, 5000);
    }

    get(channelId: string): ExchangeChannel {
        return this.channels[channelId];
    }

    add(channel: ExchangeChannel): void {
        this.channels[channel.channelId] = channel;
    }

    has(channelId: string): boolean {
        return Boolean(this.channels[channelId]);
    }
}

export class ExchangeChannel {
    private subscribers: Subscriber[] = [];
    private subscriptions: Subscription[] = [];
    private config: ExchangeChannelConfig;


    public get channelId(): string {
        return this.config.channelId;
    }

    public get question(): string {
        return this.config.question;
    }

    constructor(config: ExchangeChannelConfig) {
        this.config = config;
    }

    isAnwser(trial: string): boolean {
        return this.config.answer == trial;
    }

    createSubscriber(): Subscriber {
        let subscriber = new Subscriber();
        this.subscribers.push(subscriber);
        return subscriber;
    }

    hasSubscriber(subscriberId: string): boolean {
        let subscriber = this.subscribers.find(value => value.subscriberId == subscriberId);
        return subscriber ? true : false;
    }

    subscribe(subscription: Subscription): void {
        let subscriber = this.subscribers.find(value => value.subscriberId == subscription.subscriberId);
        if (subscriber) {
            subscriber.active();
            this.subscriptions.push(subscription);
        }
    }

    publish(subscriberId: string, data: Buffer): void {
        if (this.hasSubscriber(subscriberId)) {
            this.subscriptions = this.subscriptions.filter(i => i.subscriberId == subscriberId || (i.isAlive && i.send(data)));
        }
    }

    cleanUp(): void {
        this.subscriptions = this.subscriptions.filter(s => s.isAlive);

        let now = (new Date()).getTime();
        let _30mins = 30 * 60 * 1000;
        this.subscribers = this.subscribers.filter(s =>
            (now - s.lastActive < _30mins) || this.subscriptions.some(subscription => subscription.subscriberId == s.subscriberId));
    }

    hasSubscribers(): boolean {
        return this.subscribers.length > 0;
    }
}

export class Subscriber {
    private _lastActive: number;

    private _subscriberId: string;
    public get subscriberId(): string {
        this._lastActive = (new Date()).getTime();
        return this._subscriberId;
    }

    constructor() {
        this._subscriberId = uuid();
    }

    active() {
        this._lastActive = (new Date()).getTime();
    }

    get lastActive() {
        return this._lastActive;
    }
}

export class Subscription {
    response: express.Response;
    private _isAlive: boolean = true;

    private _subscriberId: string;
    public get subscriberId(): string {
        return this._subscriberId;
    }

    constructor(subscriberId: string, req: express.Request, res: express.Response) {
        this.response = res;
        this._subscriberId = subscriberId;
        req.on("close", () => {
            this._isAlive = false;
        });
        setTimeout(() => {
            if (!res.headersSent) {
                res.status(204).send({ status: 204 });
            }
        }, 25000);
    }

    public send(data: Buffer): void {
        this.response.send(data);
        this._isAlive = false;
    }

    get isAlive(): boolean {
        return this._isAlive;
    }
}

export interface ExchangeChannelConfig {
    channelId: string,
    question: string,
    answer: string,
}
