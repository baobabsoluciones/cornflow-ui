import { loadExcel } from '../utils/data_io'
import Ajv from 'ajv'
import { ErrorObject } from 'ajv'

export class SolutionCore {
  id: string
  data: object[]
  schema: object
  schemaChecks: object
  schemaName: string
  dataChecks: object

  constructor(
    id: string,
    data: object[],
    schema: object,
    schemaChecks: object,
    schemaName: string,
    dataChecks: object = {},
  ) {
    this.data = data
    this.schemaChecks = schemaChecks
    this.schema = schema
    this.schemaName = schemaName
    this.id = id
    this.dataChecks = dataChecks
  }

  async checkSchema(): Promise<ErrorObject<string, Record<string, any>, unknown>[] | undefined> {
    const ajv = new Ajv({ strict: false, allErrors: true })
    const validate = ajv.compile(this.schema)
    const valid = validate(this.data)
    if (!valid) {
      return validate.errors
    }
  }

  hasSolution() {
    return (
      this.data !== undefined &&
      this.data !== null &&
      Object.keys(this.data).length > 0
    )
  }

  static fromExcel(file, schema, schemaName) {
    return loadExcel(file, schema).then(
      (data) => new this(null, data, schema, {}, schemaName),
    )
  }
  
  static fromCsv(csvText, fileName, schema, schemaChecks, schemaName) {
    return new Promise((resolve, reject) => {
      try {
        // Detect the delimiter by analyzing the first line
        const firstLine = csvText.toString().split('\n')[0];
        
        // Count occurrences of common delimiters
        const delimiterCounts = {
          ',': (firstLine.match(/,/g) || []).length,
          ';': (firstLine.match(/;/g) || []).length,
          '\t': (firstLine.match(/\t/g) || []).length,
        };
        
        // Find the delimiter with the most occurrences
        let delimiter = ','; // Default
        let maxCount = 0;
        
        for (const [del, count] of Object.entries(delimiterCounts)) {
          if (count > maxCount) {
            maxCount = count;
            delimiter = del;
          }
        }
        
        // Parse CSV to JSON using detected delimiter
        const lines = csvText.toString().split('\n');
        const headers = lines[0].split(delimiter).map(header => header.trim());
        
        // Extract data from lines
        const tableData = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue; // Skip empty lines
          
          const values = lines[i].split(delimiter).map(value => value.trim());
          const row = {};
          
          // Map values to keys
          for (let j = 0; j < Math.min(headers.length, values.length); j++) {
            // Convert numeric values
            const value = values[j];
            
            // Handle quoted values (remove quotes)
            let processedValue = value;
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              processedValue = value.substring(1, value.length - 1);
            }
            
            // Try to convert to number if appropriate
            if (!isNaN(processedValue) && processedValue !== '') {
              row[headers[j]] = Number(processedValue);
            } else {
              row[headers[j]] = processedValue;
            }
          }
          
          tableData.push(row);
        }
        
        // Determine table name from filename (without extension)
        const tableName = fileName.split('.')[0];
        
        // Create data structure with table name
        const data = {
          [tableName]: tableData
        };
        
        resolve(new this(null, data, schema, schemaChecks, schemaName));
      } catch (error) {
        reject(error);
      }
    });
  }
}
