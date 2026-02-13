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
  Tag,
  Statistic,
  Row,
  Col,
  Select,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as timersApi from '../../api/endpoints/timers'
import type { Timer } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const TimersPage = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: timers, loading, refetch } = useApi(
    () => timersApi.listTimers({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    timersApi.getTimerStats,
    { immediate: true }
  )

  const { mutate: createTimer, loading: creating } = useMutation(timersApi.createTimer, {
    onSuccess: () => {
      setCreateModalVisible(false)
      form.resetFields()
      refetch()
      refetchStats()
    }
  })

  const { mutate: deleteTimer } = useMutation(timersApi.deleteTimer, {
    onSuccess: () => {
      refetch()
      refetchStats()
    }
  })

  const handleCreate = async (values: any) => {
    await createTimer(values)
  }

  const columns = [
    {
      title: 'Timer ID',
      dataIndex: 'timer_id',
      key: 'timer_id',
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'timer_type',
      key: 'timer_type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default'
        if (status === 'pending') color = 'processing'
        else if (status === 'fired') color = 'success'
        else if (status === 'cancelled') color = 'error'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Element ID',
      dataIndex: 'element_id',
      key: 'element_id',
    },
    {
      title: 'Duration',
      dataIndex: 'time_duration',
      key: 'time_duration',
      render: (duration: string) => duration || '-',
    },
    {
      title: 'Cycle',
      dataIndex: 'time_cycle',
      key: 'time_cycle',
      render: (cycle: string) => cycle || '-',
    },
    {
      title: 'Remaining',
      dataIndex: 'remaining_seconds',
      key: 'remaining_seconds',
      render: (seconds: number) => `${seconds}s`,
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Timer) => (
        <Popconfirm
          title="Delete Timer"
          description="Are you sure you want to delete this timer?"
          onConfirm={() => deleteTimer(record.timer_id)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Timers</Title>
            <Text type="secondary">Timer management and monitoring</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Timer
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refetch(); refetchStats() }} loading={loading}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Total Timers" value={stats?.total_timers || 0} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Pending" value={stats?.pending_timers || 0} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Fired" value={stats?.fired_timers || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Cancelled" value={stats?.cancelled_timers || 0} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>

        {/* Timers Table */}
        <Card title="Timers">
          <Table
            columns={columns}
            dataSource={timers?.data || []}
            rowKey="timer_id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      </Space>

      {/* Create Timer Modal */}
      <Modal
        title="Create Timer"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="timer_id" label="Timer ID" rules={[{ required: true }]}>
            <Input placeholder="unique-timer-id" />
          </Form.Item>
          <Form.Item name="element_id" label="Element ID" rules={[{ required: true }]}>
            <Input placeholder="TimerEvent_1" />
          </Form.Item>
          <Form.Item name="process_instance_id" label="Process Instance ID" rules={[{ required: true }]}>
            <Input placeholder="srv1-..." />
          </Form.Item>
          <Form.Item name="timer_type" label="Timer Type" rules={[{ required: true }]}>
            <Select placeholder="Select timer type">
              <Select.Option value="duration">Duration</Select.Option>
              <Select.Option value="cycle">Cycle</Select.Option>
              <Select.Option value="date">Date</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="time_duration" label="Duration (ISO 8601)">
            <Input placeholder="PT30S, PT1M, PT1H" />
          </Form.Item>
          <Form.Item name="time_cycle" label="Cycle (ISO 8601)">
            <Input placeholder="R5/PT10S" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TimersPage
