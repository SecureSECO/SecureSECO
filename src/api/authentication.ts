import Router from 'koa-router';
import { ParameterizedContext, Next } from 'koa';

export const linkBlockMiddleware = async (
    ctx: ParameterizedContext<any, Router.IRouterParamContext<any, {}>, any>,
    next: Next
) => {
    const public_server = process.env.SERVER_TYPE == "PUBLIC";

    if (public_server && !isLocalAdress(ctx.request.ip)) {
        ctx.status = 403;
        ctx.body = { message: 'This link is blocked.' };
    } else {
        await next();
    }
};

/** returns true if the address is a local ip address
 * should match the following ip ranges:
 * - loopback ipv4 address: 127.0.0.0 - 127.255.255.255
 * - ipv4 mapped ipv6 loopback adress: ::ffff:127.0.0.0 - ::ffff:127.255.255.255
 * - ipv6 loopback adress: ::1 */
function isLocalAdress(ip: string): Boolean {
    const localAddrRegex = /^((::(ffff(:0{1,4}){0,1}:){0,1})?127.((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){2,2}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))|(::1)$/;
    return localAddrRegex.test(ip);
}
