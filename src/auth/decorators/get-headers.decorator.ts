import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common"

export const GetHeaders = createParamDecorator(
    (data, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        const header = req.headers

        if(!header) throw new InternalServerErrorException('header is not found (request');
        
        return (!data) ? header : header[data];
    }
)