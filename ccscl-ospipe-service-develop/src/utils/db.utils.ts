import { commonLogs } from "../constants/ospipe.constants";
import { Pool } from 'pg';
import { IDbConnection } from "../interfaces/ospipe.interfaces";

export class DbConnection implements IDbConnection {

    private static instance: DbConnection;
    private pool: Pool;
    private client: any;

    private constructor() { }

    public static getInstance(): IDbConnection {
        if (!DbConnection.instance) {
            DbConnection.instance = new DbConnection();
        }
        return DbConnection.instance;
    }

    public async executeQuery(sql: string, params: string[]): Promise<any> {
        return new Promise(async (resolve) => {
            try {
                const result = await this.client.query(sql, params);
                resolve(result.rows);
            } catch (err) {
                console.error(commonLogs.errors.DB_EXEC_STATEMENT_ERROR, err as Error);
                throw err;
            }
        });
    };

    public async createConnection(data: Map<string, string>) {
        try {
            this.pool = new Pool({
                host: data.get("DATABASE_HOST"),
                database: data.get("DATABASE_NAME"),
                port: data.get("DATABASE_PORT"),
                password: data.get("DATABASE_PASS"),
                user: data.get("DATABASE_USER"),
            });
            this.client = await this.pool.connect();
        } catch (err) {
            console.error(commonLogs.errors.DB_CONNECTION_ERROR.CREATE, err as Error);
        }
    };

    public async closeConnection() {
        try {
            await this.client.release();
            await this.pool.end();
            console.debug(commonLogs.infos.DB_POOL_INFO.END);
        } catch (err) {
            console.error(commonLogs.errors.DB_CONNECTION_ERROR.CLOSE, err as Error);
        }
    };

}
