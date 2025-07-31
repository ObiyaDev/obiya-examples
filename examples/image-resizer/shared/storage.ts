import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Storage Adapter Interface
 * 
 * TODO: Implement other storage adapters by implementing this interface:
 * - SupabaseStorageAdapter
 * - CloudflareR2Adapter  
 * - GoogleCloudStorageAdapter
 * - LocalFileSystemAdapter (for development)
 */
export interface StorageAdapter {
  /**
   * Save a file buffer to storage
   * @param buffer - File buffer to save
   * @param filename - Filename/key for the file
   * @returns Promise resolving to the file URL or key
   */
  saveFile(buffer: Buffer, filename: string): Promise<string>

  /**
   * Get a public or signed URL for a file
   * @param filename - Filename/key of the file
   * @returns Public URL or signed URL for the file
   */
  getFileUrl(filename: string): string

  /**
   * Check if a file exists in storage
   * @param filename - Filename/key to check
   * @returns Promise resolving to boolean indicating existence
   */
  fileExists(filename: string): Promise<boolean>

  /**
   * Get file buffer (for processing)
   * @param filename - Filename/key of the file
   * @returns Promise resolving to file buffer
   */
  getFileBuffer(filename: string): Promise<Buffer>
}

/**
 * AWS S3 Storage Adapter Implementation
 */
export class S3StorageAdapter implements StorageAdapter {
  private s3Client: S3Client
  private bucketName: string
  private region: string

  constructor() {
    // Validate required environment variables
    const requiredEnvVars = ['AWS_S3_BUCKET_NAME', 'AWS_REGION']
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
    }

    this.bucketName = process.env.AWS_S3_BUCKET_NAME!
    this.region = process.env.AWS_REGION!

    // Initialize S3 client with credentials from environment
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }

  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: this.getContentType(filename),
      })

      await this.s3Client.send(command)
      return filename // Return the S3 key
    } catch (error) {
      throw new Error(`Failed to save file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  getFileUrl(filename: string): string {
    // Return public S3 URL (assumes bucket is configured for public read)
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${filename}`
  }

  async getSignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      })

      return await getSignedUrl(this.s3Client, command, { expiresIn })
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      // HeadObject throws an error if the object doesn't exist
      return false
    }
  }

  async getFileBuffer(filename: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      })

      const response = await this.s3Client.send(command)
      
      if (!response.Body) {
        throw new Error('No file body returned from S3')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const stream = response.Body as any

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks)))
      })
    } catch (error) {
      throw new Error(`Failed to get file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
    }
    return contentTypes[ext || ''] || 'application/octet-stream'
  }
}

/**
 * Storage factory function
 * Returns the configured storage adapter based on environment
 */
export function createStorageAdapter(): StorageAdapter {
  const storageType = process.env.STORAGE_TYPE || 's3'
  
  switch (storageType.toLowerCase()) {
    case 's3':
      return new S3StorageAdapter()
    // TODO: Add other storage adapters here
    // case 'supabase':
    //   return new SupabaseStorageAdapter()
    // case 'r2':
    //   return new CloudflareR2Adapter()
    default:
      throw new Error(`Unsupported storage type: ${storageType}`)
  }
}

/**
 * Singleton storage adapter instance
 */
let storageInstance: StorageAdapter | null = null

export function getStorageAdapter(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = createStorageAdapter()
  }
  return storageInstance
}