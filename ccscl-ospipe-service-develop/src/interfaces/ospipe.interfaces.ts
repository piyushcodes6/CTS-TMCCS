export interface OsPipeData {
    data: OsPipeContainerModel[];
}

export interface OsPipeContainerModel {
    business_entity: string;
    estimated_namc_arrival: string;
    actual_namc_arrival: string;
    devan_flag: string;
    container_renban: string;
    supplier_code: string;
    modules: OsPipeModuleModel[];
}

export interface HandlerResponse {
    statusCode: number;
    headers: Object;
    body: string;
    isBase64Encoded: boolean;
}

export interface OsPipeModuleModel {
    module_number: string;
    parts: OsPipePartsModel[];
}

export interface OsPipePartsModel {
    part_number: string;
    module_qty_summarized: string;
}

export interface IDbConnection {
    createConnection: (data: Map<string, string>) => void;
    executeQuery: (sql: string, params: string[]) => Promise<any>;
    closeConnection: () => void;
}