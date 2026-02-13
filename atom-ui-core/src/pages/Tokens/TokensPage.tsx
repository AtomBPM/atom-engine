import { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  Form,
  Input,
  Modal,
  Tag,
  Select,
  Tabs,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useApi } from '../../hooks/useApi'
import * as tokensApi from '../../api/endpoints/tokens'
import type { Token } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const TokensPage = () => {
  const [searchModalVisible, setSearchModalVisible] = useState(false)
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [stateFilter, setStateFilter] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')
  const [form] = Form.useForm()

  const { data: tokens, loading, refetch } = useApi(
    () => tokensApi.listTokens({ 
      page: 1, 
      limit: 100, 
      state: stateFilter || undefined 
    }),
    { immediate: true }
  )

  const { execute: getToken, loading: searchLoading } = useApi(
    (id: string) => tokensApi.getTokenStatus(id)
  )

  useEffect(() => {
    refetch()
  }, [stateFilter])

  const handleSearch = async (values: any) => {
    try {
      const data = await getToken(values.token_id)
      setSelectedToken(data)
      setSearchModalVisible(false)
      setInfoModalVisible(true)
      form.resetFields()
    } catch (error) {
      // Error already shown by API client
    }
  }

  const handleViewInfo = (token: Token) => {
    setSelectedToken(token)
    setInfoModalVisible(true)
  }

  const getStateColor = (state: string) => {
    if (state === 'ACTIVE') return 'processing'
    if (state === 'COMPLETED') return 'success'
    if (state === 'CANCELLED') return 'error'
    return 'default'
  }

  // Filter tokens by search text
  const filteredTokens = (tokens?.data || []).filter((token: Token) => {
    if (!searchText) return true
    const text = searchText.toLowerCase()
    return (
      token.id?.toLowerCase().includes(text) ||
      token.process_instance_id?.toLowerCase().includes(text) ||
      token.process_key?.toLowerCase().includes(text) ||
      (token.current_element_id || token.element_id)?.toLowerCase().includes(text)
    )
  })

  const columns = [
    {
      title: 'Token ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code copyable>{id}</Text>,
      width: 200,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => <Tag color={getStateColor(state)}>{state}</Tag>,
      width: 120,
    },
    {
      title: 'Process Instance',
      dataIndex: 'process_instance_id',
      key: 'process_instance_id',
      render: (id: string) => <Text code>{id}</Text>,
      ellipsis: true,
    },
    {
      title: 'Process Key',
      dataIndex: 'process_key',
      key: 'process_key',
      ellipsis: true,
    },
    {
      title: 'Element ID',
      dataIndex: 'current_element_id',
      key: 'current_element_id',
      render: (val: string, record: Token) => val || record.element_id,
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: Token) => (
        <Tooltip title="View Details">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewInfo(record)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Tokens</Title>
            <Text type="secondary">Token status and tracking</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => setSearchModalVisible(true)}
            >
              Find Token by ID
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space>
              <Text>Filter by state:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All states"
                allowClear
                value={stateFilter || undefined}
                onChange={(value) => setStateFilter(value || '')}
                options={[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Completed', value: 'COMPLETED' },
                  { label: 'Cancelled', value: 'CANCELLED' },
                ]}
              />
            </Space>
            <Space>
              <Text>Search:</Text>
              <Input
                placeholder="Search by token ID, instance ID, process key, element ID..."
                style={{ width: 400 }}
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </Space>
          </Space>
        </Card>

        {/* Tokens Table */}
        <Card title={`Tokens (${filteredTokens.length})`}>
          <Table
            columns={columns}
            dataSource={filteredTokens}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} tokens`,
            }}
          />
        </Card>
      </Space>

      {/* Search Token Modal */}
      <Modal
        title="Find Token by ID"
        open={searchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={searchLoading}
      >
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Form.Item name="token_id" label="Token ID" rules={[{ required: true }]}>
            <Input placeholder="Enter exact token ID..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Token Info Modal */}
      <Modal
        title="Token Information"
        open={infoModalVisible}
        onCancel={() => setInfoModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedToken && (
          <Tabs
            items={[
              {
                key: 'general',
                label: 'General',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div><Text type="secondary">Token ID:</Text> <Text code>{selectedToken.id}</Text></div>
                    <div><Text type="secondary">State:</Text> <Tag color={getStateColor(selectedToken.state)}>{selectedToken.state}</Tag></div>
                    <div><Text type="secondary">Process Instance ID:</Text> <Text code>{selectedToken.process_instance_id}</Text></div>
                    <div><Text type="secondary">Process Key:</Text> <Text>{selectedToken.process_key || 'N/A'}</Text></div>
                    <div><Text type="secondary">Current Element ID:</Text> <Text>{selectedToken.current_element_id || selectedToken.element_id || 'N/A'}</Text></div>
                    {selectedToken.waiting_for && (
                      <div><Text type="secondary">Waiting For:</Text> <Text>{selectedToken.waiting_for}</Text></div>
                    )}
                    <div><Text type="secondary">Created At:</Text> <Text>{dayjs(selectedToken.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                    <div><Text type="secondary">Updated At:</Text> <Text>{dayjs(selectedToken.updated_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                  </Space>
                ),
              },
              {
                key: 'variables',
                label: 'Variables',
                children: (
                  <pre style={{ 
                    padding: '16px', 
                    borderRadius: '4px',
                    maxHeight: '400px',
                    overflow: 'auto'
                  }}>
                    <code>{JSON.stringify(selectedToken.variables || {}, null, 2)}</code>
                  </pre>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default TokensPage
