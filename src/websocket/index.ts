import Router from 'koa-router';
import { measurementEvents } from '../services/measurement-store';
import { getQueueEmitter, getHeapSize } from '../services/queue-service';
import { getSpiderEmitter } from '../services/spider-service';

const router: Router = new Router({
    prefix: '/websocket',
});

router.get('/measurements', ctx => {
    const socket = (ctx as any).websocket;
    const changed = (packageName: string) => { if (socket.readyState === 1) socket.send(JSON.stringify({packageName})); };
    measurementEvents.on('changed', changed);
    socket.on('close', () => measurementEvents.off('changed', changed));
});

router.get('/', (ctx, next) => {
    getSpiderEmitter().on('info', (message) => {
        // @ts-ignore
        ctx.websocket.send(message);
    });
});

router.get('/get-queue-size', (ctx, next) => {
    // @ts-ignore
    ctx.websocket.send(`test${getHeapSize()}`);

    getQueueEmitter().on('pushed', (data) => {
        // @ts-ignore
        ctx.websocket.send(data);
    });
});

export default router;

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */