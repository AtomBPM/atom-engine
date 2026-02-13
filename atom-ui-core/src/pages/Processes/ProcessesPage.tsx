import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Popconfirm,
  Statistic,
  Row,
  Col,
  Select,
  Tabs,
  Tooltip,
} from 'antd'
import {
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as processesApi from '../../api/endpoints/processes'
import * as bpmnApi from '../../api/endpoints/bpmn'
import type { ProcessInstance, Token } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const ProcessesPage = () => {
  const navigate = useNavigate()
  const [startModalVisible, setStartModalVisible] = useState(false)
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [tokensModalVisible, setTokensModalVisible] = useState(false)
  const [selectedProcess, setSelectedProcess] = useState<ProcessInstance | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedProcessId, setSelectedProcessId] = useState<string>('')
  const [selectedBpmnKey, setSelectedBpmnKey] = useState<string>('')
  const [processVariablesInfo, setProcessVariablesInfo] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: processes, loading, refetch } = useApi(
    () => processesApi.listProcesses({ page: 1, limit: 100, status: statusFilter || undefined }),
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    processesApi.getProcessStats,
    { immediate: true }
  )

  const { data: bpmnProcesses } = useApi(
    () => bpmnApi.listBPMNProcesses({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: tokens, loading: tokensLoading, execute: loadTokens } = useApi(
    (id: string) => processesApi.getProcessTokens(id)
  )

  const { data: processXml, loading: processXmlLoading, execute: loadProcessXml } = useApi(
    (key: string) => bpmnApi.getBPMNProcessXML(key)
  )

  const { mutate: startProcess, loading: starting } = useMutation(
    processesApi.startProcess,
    {
      onSuccess: () => {
        setStartModalVisible(false)
        form.resetFields()
        refetch()
        refetchStats()
      }
    }
  )

  const { mutate: cancelProcess, loading: cancelling } = useMutation(
    processesApi.cancelProcess,
    {
      onSuccess: () => {
        refetch()
        refetchStats()
      }
    }
  )

  const handleProcessKeyChange = async (processId: string, option: any) => {
    setSelectedProcessId(processId)
    const bpmnKey = option['data-bpmn-key']
    setSelectedBpmnKey(bpmnKey)
    
    if (bpmnKey) {
      const xml = await loadProcessXml(bpmnKey)
      if (xml) {
        extractVariablesInfo(xml)
      }
    } else {
      setProcessVariablesInfo(null)
    }
  }

  const extractVariablesInfo = (xmlString: string) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
      
      let exampleJson: any = null
      
      // Search for zeebe:property elements with name="camundaModeler:exampleOutputJson"
      const properties = xmlDoc.querySelectorAll('zeebe\\:property, property')
      
      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i]
        const name = prop.getAttribute('name')
        const value = prop.getAttribute('value')
        
        if (name === 'camundaModeler:exampleOutputJson' && value) {
          try {
            // Decode HTML entities
            const decodedValue = value
              .replace(/&#34;/g, '"')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
            
            exampleJson = JSON.parse(decodedValue)
            break
          } catch (e) {
            console.error('Failed to parse exampleOutputJson', e)
          }
        }
      }
      
      setProcessVariablesInfo(exampleJson)
    } catch (e) {
      console.error('Failed to parse XML', e)
      setProcessVariablesInfo(null)
    }
  }

  const handleUseExample = () => {
    if (processVariablesInfo) {
      form.setFieldsValue({
        variables: JSON.stringify(processVariablesInfo, null, 2)
      })
    }
  }

  const handleStartProcess = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        Modal.error({ title: 'Invalid JSON', content: 'Variables must be valid JSON' })
        return
      }
    }

    await startProcess({
      process_key: values.process_key,
      variables
    })
  }

  const handleViewInfo = async (process: ProcessInstance) => {
    setSelectedProcess(process)
    setInfoModalVisible(true)
  }

  const handleViewTokens = async (process: ProcessInstance) => {
    setSelectedProcess(process)
    await loadTokens(process.instance_id)
    setTokensModalVisible(true)
  }

  const handleViewDiagram = (process: ProcessInstance) => {
    navigate(`/processes/diagram/${process.instance_id}`)
  }

  const columns = [
    {
      title: 'Instance ID',
      dataIndex: 'instance_id',
      key: 'instance_id',
      render: (id: string) => <Text code copyable>{id}</Text>,
    },
    {
      title: 'Process',
      dataIndex: 'process_name',
      key: 'process_name',
      render: (name: string, record: ProcessInstance) => (
        <div>
          <div><Text strong>{name}</Text></div>
          <div><Text type="secondary" style={{ fontSize: '12px' }}>{record.process_id}</Text></div>
        </div>
      ),
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => {
        let color = 'default'
        if (state === 'ACTIVE') color = 'processing'
        else if (state === 'COMPLETED') color = 'success'
        else if (state === 'CANCELLED') color = 'error'
        return <Tag color={color}>{state}</Tag>
      },
    },
    {
      title: 'Current Activity',
      dataIndex: 'current_activity',
      key: 'current_activity',
      ellipsis: true,
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ProcessInstance) => (
        <Space>
          <Tooltip title="View Diagram">
            <Button
              type="link"
              icon={<FundProjectionScreenOutlined />}
              onClick={() => handleViewDiagram(record)}
            />
          </Tooltip>
          <Tooltip title="View Info">
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={() => handleViewInfo(record)}
            />
          </Tooltip>
          <Tooltip title="View Tokens">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewTokens(record)}
            />
          </Tooltip>
          {record.state === 'ACTIVE' && (
            <Popconfirm
              title="Cancel Process"
              description="Are you sure you want to cancel this process?"
              onConfirm={() => cancelProcess(record.instance_id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Cancel Process">
                <Button
                  type="link"
                  danger
                  icon={<StopOutlined />}
                  loading={cancelling}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const tokenColumns = [
    {
      title: 'Token ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => <Tag color={state === 'ACTIVE' ? 'processing' : 'default'}>{state}</Tag>,
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
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Processes</Title>
            <Text type="secondary">Process instances management and monitoring</Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => setStartModalVisible(true)}
            >
              Start Process
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                refetch()
                refetchStats()
              }}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Instances"
                value={stats?.total_instances || 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Active"
                value={stats?.active_instances || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Completed"
                value={stats?.completed_instances || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Cancelled"
                value={stats?.cancelled_instances || 0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Space>
            <Text>Filter by status:</Text>
            <Select
              style={{ width: 200 }}
              placeholder="All statuses"
              allowClear
              value={statusFilter || undefined}
              onChange={(value) => {
                setStatusFilter(value || '')
                refetch()
              }}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
              ]}
            />
          </Space>
        </Card>

        {/* Processes Table */}
        <Card title="Process Instances">
          <Table
            columns={columns}
            dataSource={processes?.data || []}
            rowKey="instance_id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} processes`,
            }}
          />
        </Card>
      </Space>

      {/* Start Process Modal */}
      <Modal
        title="Start Process"
        open={startModalVisible}
        onCancel={() => {
          setStartModalVisible(false)
          form.resetFields()
          setSelectedProcessId('')
          setSelectedBpmnKey('')
          setProcessVariablesInfo(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={starting}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleStartProcess}
        >
          <Form.Item
            name="process_key"
            label="Process Key"
            rules={[{ required: true, message: 'Please select a process' }]}
          >
            <Select
              placeholder="Select a BPMN process"
              showSearch
              optionFilterProp="children"
              onChange={handleProcessKeyChange}
              loading={processXmlLoading}
            >
              {(bpmnProcesses?.data || []).map((process: any) => (
                <Select.Option key={process.key} value={process.id} data-bpmn-key={process.key}>
                  {process.name} ({process.id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {processVariablesInfo && (
            <Card 
              size="small" 
              style={{ marginBottom: 16 }}
              title={
                <Space>
                  <InfoCircleOutlined />
                  <Text strong>Process Variables</Text>
                </Space>
              }
              extra={
                <Button 
                  type="link" 
                  size="small"
                  onClick={handleUseExample}
                >
                  Use Example
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text type="secondary">This process accepts the following variables:</Text>
                <pre style={{ 
                  padding: '8px 12px', 
                  borderRadius: '4px',
                  margin: 0,
                  fontSize: '13px'
                }}>
                  <code>{JSON.stringify(processVariablesInfo, null, 2)}</code>
                </pre>
                <Space size="small" wrap>
                  {Object.entries(processVariablesInfo).map(([key, value]) => (
                    <Tag key={key} color="blue">
                      {key}: {typeof value}
                    </Tag>
                  ))}
                </Space>
              </Space>
            </Card>
          )}

          <Form.Item
            name="variables"
            label="Variables (JSON)"
          >
            <TextArea
              rows={8}
              placeholder='{"key": "value"}'
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Process Info Modal */}
      <Modal
        title="Process Information"
        open={infoModalVisible}
        onCancel={() => setInfoModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedProcess && (
          <Tabs
            items={[
              {
                key: 'general',
                label: 'General',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div><Text type="secondary">Instance ID:</Text> <Text code>{selectedProcess.instance_id}</Text></div>
                    <div><Text type="secondary">Process ID:</Text> <Text>{selectedProcess.process_id}</Text></div>
                    <div><Text type="secondary">Process Name:</Text> <Text strong>{selectedProcess.process_name}</Text></div>
                    <div><Text type="secondary">State:</Text> <Tag>{selectedProcess.state}</Tag></div>
                    <div><Text type="secondary">Current Activity:</Text> <Text>{selectedProcess.current_activity}</Text></div>
                    <div><Text type="secondary">Started At:</Text> <Text>{dayjs(selectedProcess.started_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                    <div><Text type="secondary">Updated At:</Text> <Text>{dayjs(selectedProcess.updated_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                    {selectedProcess.completed_at && (
                      <div><Text type="secondary">Completed At:</Text> <Text>{dayjs(selectedProcess.completed_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                    )}
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
                    <code>{JSON.stringify(selectedProcess.variables, null, 2)}</code>
                  </pre>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* Tokens Modal */}
      <Modal
        title={`Tokens - ${selectedProcess?.process_name || ''}`}
        open={tokensModalVisible}
        onCancel={() => setTokensModalVisible(false)}
        width={900}
        footer={null}
      >
        <Table
          columns={tokenColumns}
          dataSource={tokens?.data || []}
          rowKey="id"
          loading={tokensLoading}
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  )
}

export default ProcessesPage
