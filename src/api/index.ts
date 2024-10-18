import Router from 'koa-router';
import dltRouter from './dlt';
import spiderRouter from './spider';
import searchRouter from './search';
import crawlerRouter from './crawler';
import { clearQueue } from '../services/queue-service';
import { linkBlockMiddleware } from './authentication'

const router: Router = new Router({
    prefix: '/api',
});

// router for all paths that need verification
const verification_router: Router = new Router({});

verification_router.use(linkBlockMiddleware);

router.use(dltRouter.routes());
router.use(spiderRouter.routes());
router.use(searchRouter.routes());
router.use(crawlerRouter.routes());

router.get('/', (ctx, next) => {
    const routes = router.stack.map((route) => route.path).sort().join('\n');
    ctx.response.body = `Main entry point for api. Available routes: \n${routes}`;
});

router.get('/download', (ctx, next) => {
    ctx.response.body = 'https://github.com/SecureSECO/SecureSECO';
});

verification_router.get('/clear-queue', (ctx, next) => {
    clearQueue();
    ctx.response.body = 'Queue has been cleared.';
});

router.use(verification_router.routes())

export default router;

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
