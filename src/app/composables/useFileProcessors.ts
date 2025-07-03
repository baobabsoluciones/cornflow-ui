/**
 * File processor composable for processing files with specific prefixes before merging instances.
 * This composable provides functions to process different types of files based on their prefixes
 * as defined in the application configuration.
 * 
 * This file serves as the implementation point for custom file processors that are configured in
 * the fileProcessors section of src/app/config.ts. When files with specific prefixes are uploaded,
 * they are processed by the corresponding methods defined in this file before being merged with
 * other processed files to create the complete instance.
 * 
 * Note: Custom file processing is entirely optional. If no fileProcessors are configured in config.ts,
 * or if files don't match any configured prefix, they will be processed using the standard method
 * and merged without special handling.
 */

import { ref } from 'vue'
import { useGeneralStore } from '@/stores/general'
import { Instance } from '@/app/models/Instance'

type ProcessorFunction = (
  file: File,
  fileContent: string | ArrayBuffer,
  extension: string,
  schemas: any
) => Promise<Instance | null>

/**
 * Composable that provides methods for processing files with special prefixes
 * before they can be merged with other instances
 */
export function useFileProcessors() {
  const store = useGeneralStore()
  
  /**
   * Processes a file based on its prefix
   * @param file - The file to process
   * @param fileContent - The content of the file
   * @param extension - The file extension
   * @param schemas - Schema configuration
   * @returns A Promise resolving to a processed Instance or null if no processor found
   */
  const processFileByPrefix = async (
    file: File, 
    fileContent: string | ArrayBuffer,
    extension: string,
    schemas: any
  ) => {
    // Get the file processors configuration
    const fileProcessors = store.appConfig.parameters?.fileProcessors || {}
    
    // Check if we have any processor configured
    if (!fileProcessors || Object.keys(fileProcessors).length === 0) {
      return null
    }
    
    // Get the filename without extension
    const filename = file.name.split('.')[0]
    
    // Find a matching processor based on filename prefix
    for (const [prefix, processorName] of Object.entries(fileProcessors)) {
      if (filename.startsWith(prefix)) {
        // Call the appropriate processor method
        const processorMethod = processorName as string
        if (processors[processorMethod]) {
          return await processors[processorMethod](file, fileContent, extension, schemas)
        }
      }
    }
    
    // No matching processor found
    return null
  }
  
  /**
   * Check if a file needs special processing based on its filename
   * @param filename - The filename to check
   * @returns True if the file needs special processing, false otherwise
   */
  const needsSpecialProcessing = (filename: string) => {
    const fileProcessors = store.appConfig.parameters?.fileProcessors || {}
    if (!fileProcessors || Object.keys(fileProcessors).length === 0) {
      return false
    }
    
    const filenameWithoutExt = filename.split('.')[0]
    
    // Check if any prefix matches the beginning of the filename
    return Object.keys(fileProcessors).some(prefix => 
      filenameWithoutExt.startsWith(prefix)
    )
  }
  
  /**
   * Collection of processor methods that can be referenced in the config
   * 
   * IMPORTANT: Add your custom processor methods here following this pattern:
   * 
   * processorName: async (file, fileContent, extension, schemas) => {
   *   // 1. Parse the file content based on its extension (JSON or XLSX)
   *   // 2. Transform the data into a format that represents a part of the complete instance data
   *   // 3. Return a new Instance object with this partial data
   *   //    Note: This Instance contains only a part of the data needed for the complete instance.
   *   //    The system will merge all processed parts later to create the final instance.
   *   return new Instance(...)
   * }
   * 
   * If no processors are defined here or if a file doesn't match any prefix in the config,
   * it will be processed using the standard method.
   */
  const processors: Record<string, ProcessorFunction> = {
    // Add your processor methods here
    
    // Each processor should:
    // 1. Accept parameters: file, fileContent, extension, schemas
    // 2. Parse the file content based on its format
    // 3. Transform the data to represent a specific part of the instance
    // 4. Return a new Instance with this partial data for later merging
  }
  
  return {
    processFileByPrefix,
    needsSpecialProcessing,
    processors
  }
} 