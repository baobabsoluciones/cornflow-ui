import  client from "@/api/Api";
import { SchemaConfig } from "@/models/SchemaConfig";

export default class SchemaRepository {
  // Get schema for the app
  async getSchema(name: string): Promise<SchemaConfig> {
    const response = await client.get(`/schema/${name}/`);

    if (response.status === 200) {
      const schema = response.content;
      return new SchemaConfig(schema.config, schema.instanceSchema, schema.instanceChecksSchema, schema.solutionSchema, schema.solutionChecksSchema, schema.name)
    } else {
      throw new Error("Error getting schema")
    }
 }

}