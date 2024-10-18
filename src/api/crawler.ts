/** Module contains api endpoints for the crawler, which grabs collects some
 * packages and adds them to the system to be spidered.*/
import Router from 'koa-router';
import { runCrawler } from '../services/crawler-service';

const router: Router = new Router({
    prefix: '/crawler',
});

router.post('/add-top-packages', async (ctx, next) => {
    const {
        platform, count
    } = ctx.request.body;
    const packages = await runCrawler(platform, count);
    ctx.response.body = packages.reduce((total, val) => `${total} ${val},`, "requested packages: ");
});

export default router;

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */