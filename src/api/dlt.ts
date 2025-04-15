import Router from 'koa-router';
import {
    getAccount, getGitHubLink, getJobs, getMetrics, getPackageData, 
    getPackagesData, getTrustFacts, getTrustScore, storeGitHubLink, 
    getTrustScoreCategories, getTopPackages
} from '../services/dlt-service';
import { getKeys } from '../keys';
import addAllJobs, {getMostRecentVersionGithub} from '../services/add-job-service';
import { linkBlockMiddleware } from './authentication'

const router: Router = new Router({
    prefix: '/dlt',
});

// router for all paths that need verification
const verification_router: Router = new Router({});

verification_router.use(linkBlockMiddleware);

router.get('/trust-facts/:packageName', async (ctx, next) => {
    const { packageName } = ctx.params;
    ctx.response.body = await getTrustFacts(packageName);
});

router.get('/jobs', async (ctx, next) => {
    ctx.response.body = await getJobs();
});

verification_router.get('/get-gpg-key', async (ctx, next) => {
    const { publicKey } = await getKeys();
    ctx.response.body = publicKey;
});

verification_router.get('/get-github-link', async (ctx, next) => {
    ctx.response.body = await getGitHubLink();
});

verification_router.post('/add-job', async (ctx, next) => {
    const {
        name, owner, platform, release,
    } = ctx.request.body;
    await addAllJobs({
        packageName: name,
        packagePlatform: platform,
        packageOwner: owner,
        packageReleases: [release],
    });
    ctx.response.body = 'Added jobs.';
});

router.post('/get-most-recent-version', async (ctx, next) => {
    const {
        name, owner, platform
    } = ctx.request.body;
    ctx.response.body = await getMostRecentVersionGithub({
        packageName: name,
        packagePlatform: platform,
        packageOwner: owner,
        packageReleases: [],
    });
});

verification_router.post('/store-github-link', async (ctx, next) => {
    const storedOnGithub = await storeGitHubLink(ctx.request.body.data);
    ctx.response.body = {
        stored_on_github: storedOnGithub,
    };
    ctx.response.status = 200;
});

router.get('/packages', async (ctx, next) => {
    let { from, count, query } = ctx.query;

    ctx.response.body = await getPackagesData(
        from ? Number(from) : undefined,
        count ? Number(count) : undefined,
        (Array.isArray(query) ? query.flat(1) : query) as string
    );
});


router.get('/leaderboard', async (ctx, next) => {
    const { order, count } = ctx.query;
    ctx.response.body = await getTopPackages(order === "descending" || !order, count ? Number(count) : 10);
});

router.get('/package/:id', async (ctx, next) => {
    const { id } = ctx.params;
    ctx.response.body = await getPackageData(id);
});

router.get('/metrics', async (ctx, next) => {
    ctx.response.body = await getMetrics();
});

router.get('/package/:id/trust-score/:version', async (ctx, next) => {
    const { id, version } = ctx.params;
    ctx.response.body = await getTrustScore(id, version);
});

router.get('/package/:id/trust-score/', async (ctx, next) => {
    const { id } = ctx.params;
    ctx.response.body = await getTrustScore(id);
});

router.get('/package/:id/trust-score-categories/:version', async (ctx, next) => {
    const { id, version } = ctx.params;
    ctx.response.body = await getTrustScoreCategories(id, version);
});

verification_router.get('/account', async (ctx, next) => {
    ctx.response.body = await getAccount();
});

router.use(verification_router.routes())

export default router;

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
