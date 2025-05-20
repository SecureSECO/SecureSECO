/** Module contains api endpoints for the crawler, which grabs collects some
 * packages and adds them to the system to be spidered.*/
import Router from 'koa-router';
import { runCrawler } from '../services/crawler-service';
import { linkBlockMiddleware } from './authentication'

const router: Router = new Router({
    prefix: '/crawler',
});

// router for all paths that need verification
const verification_router: Router = new Router({});

verification_router.use(linkBlockMiddleware);

verification_router.post('/add-top-packages', async (ctx, next) => {
    let {
        platform, count, from
    } = ctx.request.body;
    if (from === undefined) from = 0;
    from = Number(from);
    count = Number(count);
    const packages = await runCrawler(platform, count, from);
    ctx.response.body = packages.reduce((total, val) => `${total} ${val},`, "requested packages: ");
});

router.use(verification_router.routes())

export default router;

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */