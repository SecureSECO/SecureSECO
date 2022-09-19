/* eslint-disable camelcase */
import Router from 'koa-router';
import {
    changeMinerState,
    createMiner,
    getMetrics,
    getMiner,
    getMiners,
    rerunMiner,
} from '../services/search-service';

const router: Router = new Router({
    prefix: '/search',
});

router.post('/add-miner', async (ctx) => {
    ctx.response.body = await createMiner({ ...ctx.request.body });
});

router.get('/miners', async (ctx) => {
    ctx.response.body = await getMiners();
});

router.get('/miner/:id', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await getMiner(id);
});

router.get('/miner/:id/remove', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await changeMinerState(id, 'remove');
});

router.get('/miner/:id/rerun', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await rerunMiner(id);
});

router.get('/miner/:id/restart', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await changeMinerState(id, 'restart');
});

router.get('/miner/:id/start', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await changeMinerState(id, 'start');
});

router.get('/miner/:id/stop', async (ctx) => {
    const { id } = ctx.params;
    ctx.response.body = await changeMinerState(id, 'stop');
});

router.get('/metrics', async (ctx) => {
    ctx.response.body = await getMetrics();
});

export default router;
