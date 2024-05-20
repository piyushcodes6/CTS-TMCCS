import { getConfigParams } from '@tmna-devops/ccscl-rundown-common-lib';
import { OsPipeData } from '../interfaces/ospipe.interfaces';
import { DbConnection } from "../utils/db.utils";
import { commonLogs, sqlStatements } from '../constants/ospipe.constants';
const util = require('node:util')

export class OSPipeService {
  private dbCon = DbConnection.getInstance();

  public async ProcessOsPipeData(osPipeData: OsPipeData): Promise<string> {
    try {
      var connectionString: Map<string, string> = await getConfigParams();
      await this.dbCon.createConnection(connectionString);
      return await this.UpsertOsPipeData(osPipeData);
    } catch (err) {
      console.error(commonLogs.errors.SECRET_MGR_RETREIVE_ERROR, err as Error);
      throw err;
    }
  }

  /*
    Function to Insert/Update the OS Pipe Container & Parts Data.
  */
  private async UpsertOsPipeData(osPipeData: OsPipeData): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        let insertOverseasContainerSQLStr = '';
        let insertOverseasPartsSQLStr = '';
        //below lines to be uncommented later
        // Fetching the Schema name and namc_id from tmm.ccsb_namc table 
        // and generate query for insert/update for the respective namc schema.
        // await this.dbCon.executeQuery(`${sqlStatements.NAMCQuery.SELECT_QUERY}`, null).then(async (fetchSchema) => {
          // for (let schemaCount = 0; schemaCount < fetchSchema.length; schemaCount++) {
            let containerOutput = '';
            let partsOutput = '';
            let filteredData = osPipeData.data; //.filter(data => data.business_entity == fetchSchema[schemaCount].namc_id);
            if (filteredData && filteredData.length > 0) {
              for (let i = 0; i < filteredData.length; i++) {
                const data = filteredData[i];
                const container = data.container_renban.trim();
                const namc_id = data.business_entity.trim();
                let estgtn = null, actgtn = null, devanned = null;
                if (data.estimated_namc_arrival) {
                  estgtn = data.estimated_namc_arrival.trim();
                }
                if (data.actual_namc_arrival) {
                  actgtn = data.actual_namc_arrival.trim()
                }
                if (data.devan_flag) {
                  devanned = data.devan_flag.trim();
                }
                let containerValues = `('${container}','${namc_id}',`;
                // checking values are available estimated_namc_arrival, actual_namc_arrival &  devan_flag
                // if values are not available using null or append single quote to value
                // so that it won't consider null as string.
                containerValues += (estgtn ? `'${estgtn}'` : null) + ",";
                containerValues += (actgtn ? `'${actgtn}'` : null) + ",";
                containerValues += (devanned ? `'${devanned}'` : null) + "),\n";
                for (let j = 0; j < data.modules.length; j++) {
                  var module = data.modules[j];
                  var moduleNumber = module.module_number;
                  for (let k = 0; k < module.parts.length; k++) {
                    var part = module.parts[k];
                    const quantity = part.module_qty_summarized ? parseInt(part.module_qty_summarized) : null;
                    var supplierCode = null;
                    // truncating the supplier_code to 5 character limit since column length is 5.
                    if (data.supplier_code) {
                      supplierCode = data.supplier_code.length > 5 ? data.supplier_code.substring(2, 7) : data.supplier_code;
                    }
                    let partsValue = `('${container}','${namc_id}','${moduleNumber}','${part.part_number}',${quantity},`; //,'${supplierCode}'),\n`
                    partsValue += (supplierCode ? `'${supplierCode}'` : null) + "),\n";
                    partsOutput += partsValue;
                  }
                }
                containerOutput += containerValues;
              }
              //hardcoded schema name to be removed later
              insertOverseasContainerSQLStr += util.format(sqlStatements.osContainerUpsertSql.INSERT_OVERSEAS_CONTAINER, 'tmm' /*fetchSchema[schemaCount].schema_name*/) + containerOutput.substring(0, containerOutput.length - 2) + sqlStatements.osContainerUpsertSql.UPDATE_OVERSEAS_CONTAINER;
              insertOverseasPartsSQLStr += util.format(sqlStatements.osPartsUpsertSql.INSERT_OVERSEAS_PARTS, 'tmm' /* fetchSchema[schemaCount].schema_name*/) + partsOutput.substring(0, partsOutput.length - 2) + sqlStatements.osPartsUpsertSql.UPDATE_OVERSEAS_PARTS;
            }
          // }
          //Executing the query
          let t1 = performance.now();
          let result = await this.dbCon.executeQuery(insertOverseasContainerSQLStr, null);
          let t2 = performance.now();
          console.log(`Time Taken for OSPipe Container: ${(t2 - t1) / 1000} seconds`);
          t1 = performance.now();
          result = await this.dbCon.executeQuery(insertOverseasPartsSQLStr, null);
          t2 = performance.now();
          console.log(`Time Taken for OSPipe Parts: ${(t2 - t1) / 1000} seconds`);
          this.dbCon.closeConnection();
          resolve("Data processing completed successfully!");
          //below lines to be uncommented
        // })
        //   .catch(err => {
        //     this.dbCon.closeConnection();
        //     reject(err as Error);
        //   });
      }
      catch (err) {
        this.dbCon.closeConnection();
        reject(err as Error);
      }
    });
  };
}