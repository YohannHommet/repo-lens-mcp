import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// Get path to the built server
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_PATH = join(__dirname, '../dist/index.js')

async function main() {
  console.log('🚀 Starting MCP Server Test Client...')
  console.log(`📡 Server path: ${SERVER_PATH}`)

  // 1. Configure transport (Stdio)
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH],
  })

  // 2. Create Client
  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  )

  try {
    // 3. Connect
    console.log('🔌 Connecting to server...')
    await client.connect(transport)
    console.log('✅ Connected!')

    // 4. List Tools
    console.log('\n🛠️  Listing available tools...')
    const tools = await client.listTools()

    console.log(`Found ${tools.tools.length} tools:`)
    tools.tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description?.slice(0, 60)}...`)
    })

    // 5. Test a simple call (list_repositories)
    console.log('\n🧪 Testing tool: list_repositories...')
    const result = await client.callTool({
      name: 'list_repositories',
      arguments: {},
    })

    console.log('📦 Result:', JSON.stringify(result, null, 2))

    console.log('\n✅ Test finished successfully')
  }
  catch (error) {
    console.error('❌ Test failed:', error)
  }
  finally {
    // Cleanup
    await client.close()
  }
}

main().catch(console.error)
