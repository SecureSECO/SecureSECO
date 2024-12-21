import Koa from 'koa';
import serve from 'koa-static';
import send from 'koa-send';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import websockify from 'koa-websocket';
import apiRouter from './api';
import websocketRouter from './websocket';
import setup from './keys';
import { startQueue } from './services/queue-service';
import { loadSpiderSettings } from './services/spider-service';

setup();
(async () => {
    await sleep(5000);
    await loadSpiderSettings();
    await startQueue();
})();

const app = websockify(new Koa());

app.proxy = true; // Trust proxy fields

app.use(cors()).use(koaBody());

// Api Routes
app.use(apiRouter.routes()).use(apiRouter.allowedMethods());

// Websocket routes
app.ws.use(websocketRouter.routes()).use(websocketRouter.allowedMethods());

// Portal serving
app.use(serve('./public'));
app.use(async (ctx, next) => send(ctx, 'public/index.html'));

app.listen(3000);

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */