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
  Select,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as jobsApi from '../../api/endpoints/jobs'
import type { Job } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const JobsPage = () => {
  const [modalType, setModalType] = useState<string>('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [form] = Form.useForm()

  const { data: jobs, loading, refetch } = useApi(
    () => jobsApi.listJobs({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    jobsApi.getJobStats,
    { immediate: true }
  )

  const { mutate: activateJobs, loading: activating } = useMutation(jobsApi.activateJobs, {
    onSuccess: () => {
      setModalType('')
      form.resetFields()
      refetch()
    }
  })

  const { mutate: completeJob, loading: completing } = useMutation(jobsApi.completeJob, {
    onSuccess: () => {
      setModalType('')
      form.resetFields()
      refetch()
      refetchStats()
    }
  })

  const { mutate: failJob } = useMutation(jobsApi.failJob, {
    onSuccess: () => {
      setModalType('')
      form.resetFields()
      refetch()
      refetchStats()
    }
  })

  const { mutate: throwError } = useMutation(jobsApi.throwJobError, {
    onSuccess: () => {
      setModalType('')
      form.resetFields()
      refetch()
    }
  })

  const { mutate: updateRetries } = useMutation(
    (data: { key: string; retries: number }) => jobsApi.updateJobRetries(data.key, data.retries),
    {
      onSuccess: () => {
        setModalType('')
        form.resetFields()
        refetch()
      }
    }
  )

  const { mutate: updateTimeout } = useMutation(
    (data: { key: string; timeout_ms: number }) => jobsApi.updateJobTimeout(data.key, data.timeout_ms),
    {
      onSuccess: () => {
        setModalType('')
        form.resetFields()
        refetch()
      }
    }
  )

  const { mutate: cancelJob } = useMutation(jobsApi.cancelJob, {
    onSuccess: () => {
      refetch()
      refetchStats()
    }
  })

  const handleActivate = async (values: any) => {
    await activateJobs(values)
  }

  const handleComplete = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        Modal.error({ title: 'Invalid JSON', content: 'Variables must be valid JSON' })
        return
      }
    }
    await completeJob(selectedJob!.key, variables)
  }

  const handleFail = async (values: any) => {
    await failJob(selectedJob!.key, values)
  }

  const handleThrowError = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        Modal.error({ title: 'Invalid JSON', content: 'Variables must be valid JSON' })
        return
      }
    }
    await throwError(selectedJob!.key, { ...values, variables })
  }

  const columns = [
    {
      title: 'Job Key',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => <Text code>{key}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => {
        let color = 'default'
        if (state === 'activatable' || state === 'running') color = 'processing'
        else if (state === 'completed') color = 'success'
        else if (state === 'failed') color = 'error'
        return <Tag color={color}>{state.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Worker',
      dataIndex: 'worker',
      key: 'worker',
      render: (worker: string) => worker || '-',
    },
    {
      title: 'Retries',
      dataIndex: 'retries',
      key: 'retries',
    },
    {
      title: 'Process Instance',
      dataIndex: 'process_instance_id',
      key: 'process_instance_id',
      render: (id: string) => <Text code style={{ fontSize: '11px' }}>{id?.substring(0, 12)}...</Text>,
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
      render: (_: any, record: Job) => (
        <Space size="small" wrap>
          {record.state !== 'completed' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => {
                setSelectedJob(record)
                setModalType('complete')
              }}
            >
              Complete
            </Button>
          )}
          {record.state !== 'failed' && record.state !== 'completed' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setSelectedJob(record)
                setModalType('fail')
              }}
            >
              Fail
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<WarningOutlined />}
            onClick={() => {
              setSelectedJob(record)
              setModalType('throw-error')
            }}
          >
            Throw Error
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedJob(record)
              setModalType('update-retries')
            }}
          >
            Retries
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedJob(record)
              setModalType('update-timeout')
            }}
          >
            Timeout
          </Button>
          <Popconfirm
            title="Cancel Job"
            description="Are you sure?"
            onConfirm={() => cancelJob(record.key)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
            >
              Cancel
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Jobs</Title>
            <Text type="secondary">Job management, activation, and monitoring</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => setModalType('activate')}
            >
              Activate Jobs
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
              <Statistic title="Total Jobs" value={stats?.total_jobs || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Active" value={stats?.active_jobs || 0} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Completed" value={stats?.completed_jobs || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="Failed" value={stats?.failed_jobs || 0} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>

        {/* Jobs Table */}
        <Card title="Jobs">
          <Table
            columns={columns}
            dataSource={jobs?.data || []}
            rowKey="key"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>

      {/* Activate Jobs Modal */}
      <Modal
        title="Activate Jobs"
        open={modalType === 'activate'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={activating}
      >
        <Form form={form} layout="vertical" onFinish={handleActivate}>
          <Form.Item name="type" label="Job Type" rules={[{ required: true }]}>
            <Input placeholder="e.g., service-task" />
          </Form.Item>
          <Form.Item name="worker" label="Worker Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., my-worker" />
          </Form.Item>
          <Form.Item name="max_jobs" label="Max Jobs" initialValue={10}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="timeout_ms" label="Timeout (ms)" initialValue={30000}>
            <InputNumber min={1000} max={300000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Complete Job Modal */}
      <Modal
        title={`Complete Job - ${selectedJob?.key}`}
        open={modalType === 'complete'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={completing}
      >
        <Form form={form} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="variables" label="Variables (JSON)">
            <TextArea rows={6} placeholder='{"result": "success"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Fail Job Modal */}
      <Modal
        title={`Fail Job - ${selectedJob?.key}`}
        open={modalType === 'fail'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleFail}>
          <Form.Item name="retries" label="Retries" initialValue={0} rules={[{ required: true }]}>
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="error_message" label="Error Message">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="backoff_ms" label="Backoff (ms)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Throw Error Modal */}
      <Modal
        title={`Throw Error - ${selectedJob?.key}`}
        open={modalType === 'throw-error'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleThrowError}>
          <Form.Item name="error_code" label="Error Code" rules={[{ required: true }]}>
            <Input placeholder="e.g., BUSINESS_ERROR" />
          </Form.Item>
          <Form.Item name="error_message" label="Error Message">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="variables" label="Variables (JSON)">
            <TextArea rows={4} placeholder='{}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Retries Modal */}
      <Modal
        title={`Update Retries - ${selectedJob?.key}`}
        open={modalType === 'update-retries'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => {
          const retries = form.getFieldValue('retries')
          updateRetries({ key: selectedJob!.key, retries })
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="retries" label="Retries" initialValue={selectedJob?.retries || 3}>
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Timeout Modal */}
      <Modal
        title={`Update Timeout - ${selectedJob?.key}`}
        open={modalType === 'update-timeout'}
        onCancel={() => { setModalType(''); form.resetFields() }}
        onOk={() => {
          const timeout_ms = form.getFieldValue('timeout_ms')
          updateTimeout({ key: selectedJob!.key, timeout_ms })
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="timeout_ms" label="Timeout (ms)" initialValue={30000}>
            <InputNumber min={1000} max={300000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default JobsPage
