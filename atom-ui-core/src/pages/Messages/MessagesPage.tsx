import { useState } from 'react'
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Statistic,
  Row,
  Col,
  Tabs,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  SendOutlined,
  DeleteOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as messagesApi from '../../api/endpoints/messages'
import type { Message, MessageSubscription } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const MessagesPage = () => {
  const [publishModalVisible, setPublishModalVisible] = useState(false)
  const [testModalVisible, setTestModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: messages, loading: messagesLoading, refetch: refetchMessages } = useApi(
    () => messagesApi.listBufferedMessages({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: subscriptions, loading: subscriptionsLoading, refetch: refetchSubscriptions } = useApi(
    messagesApi.listMessageSubscriptions,
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    messagesApi.getMessageStats,
    { immediate: true }
  )

  const { mutate: publishMessage, loading: publishing } = useMutation(messagesApi.publishMessage, {
    onSuccess: () => {
      setPublishModalVisible(false)
      form.resetFields()
      refetchMessages()
      refetchStats()
    }
  })

  const { mutate: cleanupExpired } = useMutation(messagesApi.cleanupExpiredMessages, {
    onSuccess: () => {
      refetchMessages()
      refetchStats()
    }
  })

  const { mutate: testMessage, loading: testing } = useMutation(messagesApi.testMessage, {
    onSuccess: () => {
      setTestModalVisible(false)
      form.resetFields()
    }
  })

  const handlePublish = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        Modal.error({ title: 'Invalid JSON', content: 'Variables must be valid JSON' })
        return
      }
    }
    await publishMessage({ ...values, variables })
  }

  const messageColumns = [
    {
      title: 'Message ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id.substring(0, 12)}...</Text>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Correlation Key',
      dataIndex: 'correlation_key',
      key: 'correlation_key',
      render: (key: string) => key || '-',
    },
    {
      title: 'TTL (sec)',
      dataIndex: 'ttl',
      key: 'ttl',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const subscriptionColumns = [
    {
      title: 'Subscription ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id.substring(0, 12)}...</Text>,
    },
    {
      title: 'Message Name',
      dataIndex: 'message_name',
      key: 'message_name',
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: 'Correlation Key',
      dataIndex: 'correlation_key',
      key: 'correlation_key',
      render: (key: string) => key || '-',
    },
    {
      title: 'Process Instance',
      dataIndex: 'process_instance_id',
      key: 'process_instance_id',
      render: (id: string) => <Text code style={{ fontSize: '11px' }}>{id?.substring(0, 12)}...</Text>,
    },
    {
      title: 'Element ID',
      dataIndex: 'element_id',
      key: 'element_id',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm'),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Messages</Title>
            <Text type="secondary">Message publishing, subscriptions, and management</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => setPublishModalVisible(true)}
            >
              Publish Message
            </Button>
            <Button
              icon={<ExperimentOutlined />}
              onClick={() => setTestModalVisible(true)}
            >
              Test
            </Button>
            <Popconfirm
              title="Cleanup Expired Messages"
              description="Delete all expired buffered messages?"
              onConfirm={() => cleanupExpired()}
            >
              <Button icon={<DeleteOutlined />} danger>
                Cleanup Expired
              </Button>
            </Popconfirm>
            <Button icon={<ReloadOutlined />} onClick={() => { refetchMessages(); refetchSubscriptions(); refetchStats() }} loading={messagesLoading}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Total Messages" value={stats?.total_messages || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Buffered" value={stats?.buffered_messages || 0} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Delivered" value={stats?.delivered_messages || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Subscriptions" value={stats?.subscriptions_count || 0} />
            </Card>
          </Col>
        </Row>

        {/* Tables */}
        <Card>
          <Tabs
            items={[
              {
                key: 'buffered',
                label: 'Buffered Messages',
                children: (
                  <Table
                    columns={messageColumns}
                    dataSource={messages?.data || []}
                    rowKey="id"
                    loading={messagesLoading}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
              {
                key: 'subscriptions',
                label: 'Subscriptions',
                children: (
                  <Table
                    columns={subscriptionColumns}
                    dataSource={subscriptions?.data || []}
                    rowKey="id"
                    loading={subscriptionsLoading}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>

      {/* Publish Message Modal */}
      <Modal
        title="Publish Message"
        open={publishModalVisible}
        onCancel={() => {
          setPublishModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={publishing}
      >
        <Form form={form} layout="vertical" onFinish={handlePublish}>
          <Form.Item name="message_name" label="Message Name" rules={[{ required: true }]}>
            <Input placeholder="OrderCreated" />
          </Form.Item>
          <Form.Item name="correlation_key" label="Correlation Key">
            <Input placeholder="order-123" />
          </Form.Item>
          <Form.Item name="ttl_seconds" label="TTL (seconds)" initialValue={60}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="variables" label="Variables (JSON)">
            <TextArea rows={6} placeholder='{"orderId": "123", "amount": 100}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Message Modal */}
      <Modal
        title="Test Message"
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={testing}
      >
        <Form form={form} layout="vertical" onFinish={(values) => testMessage(values)}>
          <Form.Item name="message_name" label="Message Name" rules={[{ required: true }]}>
            <Input placeholder="TestMessage" />
          </Form.Item>
          <Form.Item name="correlation_key" label="Correlation Key">
            <Input />
          </Form.Item>
          <Form.Item name="variables" label="Variables (JSON)">
            <TextArea rows={4} placeholder='{}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MessagesPage
