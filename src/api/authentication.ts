import Router from 'koa-router';
import { ParameterizedContext, Next } from 'koa';

export const linkBlockMiddleware = async (
    ctx: ParameterizedContext<any, Router.IRouterParamContext<any, {}>, any>,
    next: Next
) => {
    const public_server = process.env.SERVER_TYPE == "PUBLIC";

    if (public_server) {
        ctx.status = 403;
        ctx.body = { message: 'This link is blocked.' };
    } else {
        await next();
    }
};
