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
  CheckOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as incidentsApi from '../../api/endpoints/incidents'
import type { Incident } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const IncidentsPage = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [resolveModalVisible, setResolveModalVisible] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [form] = Form.useForm()

  const { data: incidents, loading, refetch } = useApi(
    () => incidentsApi.listIncidents({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    incidentsApi.getIncidentStats,
    { immediate: true }
  )

  const { mutate: createIncident, loading: creating } = useMutation(incidentsApi.createIncident, {
    onSuccess: () => {
      setCreateModalVisible(false)
      form.resetFields()
      refetch()
      refetchStats()
    }
  })

  const { mutate: resolveIncident, loading: resolving } = useMutation(incidentsApi.resolveIncident, {
    onSuccess: () => {
      setResolveModalVisible(false)
      form.resetFields()
      refetch()
      refetchStats()
    }
  })

  const handleCreate = async (values: any) => {
    await createIncident(values)
  }

  const handleResolve = async (values: any) => {
    await resolveIncident(selectedIncident!.id, values)
  }

  const columns = [
    {
      title: 'Incident ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id.substring(0, 12)}...</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="orange">{type}</Tag>,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => {
        let color = state === 'open' ? 'error' : 'success'
        return <Tag color={color}>{state.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
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
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Incident) => (
        record.state === 'open' ? (
          <Button
            type="link"
            icon={<CheckOutlined />}
            onClick={() => {
              setSelectedIncident(record)
              setResolveModalVisible(true)
            }}
          >
            Resolve
          </Button>
        ) : (
          <Tag color="success">Resolved</Tag>
        )
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Incidents</Title>
            <Text type="secondary">Incident management and resolution</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Incident
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refetch(); refetchStats() }} loading={loading}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic 
                title="Total Incidents" 
                value={stats?.total_incidents || 0}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic 
                title="Open" 
                value={stats?.open_incidents || 0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic 
                title="Resolved" 
                value={stats?.resolved_incidents || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Incidents Table */}
        <Card title="Incidents">
          <Table
            columns={columns}
            dataSource={incidents?.data || []}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      </Space>

      {/* Create Incident Modal */}
      <Modal
        title="Create Incident"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="type" label="Incident Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              <Select.Option value="JOB_NO_RETRIES">Job No Retries</Select.Option>
              <Select.Option value="UNHANDLED_ERROR">Unhandled Error</Select.Option>
              <Select.Option value="CONDITION_ERROR">Condition Error</Select.Option>
              <Select.Option value="EXTRACT_VALUE_ERROR">Extract Value Error</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="message" label="Message" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe the incident..." />
          </Form.Item>
          <Form.Item name="process_instance_id" label="Process Instance ID" rules={[{ required: true }]}>
            <Input placeholder="srv1-..." />
          </Form.Item>
          <Form.Item name="element_id" label="Element ID" rules={[{ required: true }]}>
            <Input placeholder="ServiceTask_1" />
          </Form.Item>
          <Form.Item name="job_key" label="Job Key (optional)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Incident Modal */}
      <Modal
        title={`Resolve Incident - ${selectedIncident?.id?.substring(0, 12)}...`}
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={resolving}
      >
        <Form form={form} layout="vertical" onFinish={handleResolve}>
          <Form.Item name="resolution" label="Resolution Notes">
            <TextArea rows={4} placeholder="Describe how the incident was resolved..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default IncidentsPage
