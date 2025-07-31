#!/usr/bin/env node

/**
 * Test script to verify S3 connection and configuration
 * Usage: node scripts/test-s3-connection.js
 */

require('dotenv').config()

async function testS3Connection() {
  try {
    console.log('🔍 Testing S3 connection...\n')

    // Check environment variables
    const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET_NAME']
    const missingVars = requiredVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:')
      missingVars.forEach(varName => console.error(`   - ${varName}`))
      console.error('\nPlease check your .env file.')
      process.exit(1)
    }

    console.log('✅ Environment variables found:')
    console.log(`   - AWS_REGION: ${process.env.AWS_REGION}`)
    console.log(`   - AWS_S3_BUCKET_NAME: ${process.env.AWS_S3_BUCKET_NAME}`)
    console.log(`   - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`)
    console.log()

    // Test storage adapter
    const { createStorageAdapter } = require('../shared/storage')
    const storage = createStorageAdapter()

    console.log('🔧 Storage adapter created successfully')

    // Test a simple operation (check if bucket is accessible)
    const testKey = 'test-connection.txt'
    const testBuffer = Buffer.from('S3 connection test', 'utf8')

    console.log('📤 Testing file upload...')
    await storage.saveFile(testBuffer, testKey)
    console.log('✅ File uploaded successfully')

    console.log('🔍 Testing file existence check...')
    const exists = await storage.fileExists(testKey)
    console.log(`✅ File exists: ${exists}`)

    console.log('🌐 Testing URL generation...')
    const url = storage.getFileUrl(testKey)
    console.log(`✅ Generated URL: ${url}`)

    console.log('📥 Testing file download...')
    const downloadedBuffer = await storage.getFileBuffer(testKey)
    console.log(`✅ Downloaded ${downloadedBuffer.length} bytes`)

    console.log('\n🎉 All S3 tests passed! Your configuration is working correctly.')
    console.log('\n💡 You can now start the Motia server with: npm run dev')

  } catch (error) {
    console.error('\n❌ S3 connection test failed:')
    console.error(`   Error: ${error.message}`)
    
    if (error.message.includes('credentials')) {
      console.error('\n💡 Troubleshooting tips:')
      console.error('   - Check your AWS credentials in .env file')
      console.error('   - Verify your AWS access key and secret key are correct')
      console.error('   - Ensure your AWS user has S3 permissions')
    } else if (error.message.includes('bucket')) {
      console.error('\n💡 Troubleshooting tips:')
      console.error('   - Verify the S3 bucket name is correct')
      console.error('   - Check that the bucket exists in the specified region')
      console.error('   - Ensure your AWS user has access to this bucket')
    } else if (error.message.includes('region')) {
      console.error('\n💡 Troubleshooting tips:')
      console.error('   - Verify the AWS region is correct')
      console.error('   - Check that your bucket is in the specified region')
    }
    
    process.exit(1)
  }
}

// Run the test
testS3Connection()