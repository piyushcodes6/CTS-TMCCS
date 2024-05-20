import { APIGatewayEvent, Callback, Context, Handler } from "aws-lambda";
import { HandlerResponse, OsPipeData } from "../interfaces/ospipe.interfaces";
import { OSPipeService } from "../service/ospipe.service";
import { commonLogs } from "../constants/ospipe.constants";

export const processOsPipeData: Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    let response: HandlerResponse | null = null, error: any | null = null;
    const data: OsPipeData = JSON.parse(event.body);
    console.log(`Data Count: ${data.data.length}`);
    let invalidData = data.data.filter(data => data.business_entity == null || data.business_entity == ""
        || data.container_renban == null || data.container_renban == ""
        || !data.modules || data.modules.length == 0 || data.modules.some(module => module.module_number == "" || module.module_number == null
            || !module.parts || module.parts.length == 0 || module.parts.some(part => part.part_number == "" || part.part_number == null || (part.module_qty_summarized != null && part.module_qty_summarized != "" && part.module_qty_summarized != undefined && parseInt(part.module_qty_summarized) < 0)))
    )
    console.log(`Invalid Data Count: ${invalidData.length}`);
    if (invalidData && invalidData.length > 0) {
        response = {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({
                'errorMessage': commonLogs.errors.DATA_VALIDATION_ERROR
            }),
            isBase64Encoded: false
        };
        cb(null, response);
    }
    else if (data && data.data && data.data.length > 0) {
        const osPipeService = new OSPipeService();
        await osPipeService.ProcessOsPipeData(data).then(res => {
            response = {
                statusCode: 200,
                headers: headers,
                isBase64Encoded: false,
                body: JSON.stringify(res),
            };
            cb(null, response);
        }).catch(err => {
            error = err as Error;
            console.error(commonLogs.errors.HANDLER_ERROR, error);
            response = {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({
                    'errorMessage': error.message,
                    'errorStack': error.stack
                }),
                isBase64Encoded: false,
            };
            cb(null, response);
        });
    }
    else {
        response = {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({
                'errorMessage': commonLogs.errors.DATA_PROCESSING_ERROR
            }),
            isBase64Encoded: false
        };
        cb(null, response);
    }
}