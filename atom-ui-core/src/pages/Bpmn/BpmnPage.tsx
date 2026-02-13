import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Typography, 
  Upload, 
  message, 
  Modal, 
  Tag,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Input
} from 'antd'
import {
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  CodeOutlined,
  ApiOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as bpmnApi from '../../api/endpoints/bpmn'
import type { BPMNProcess } from '../../types/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input

const BpmnPage = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [selectedProcess, setSelectedProcess] = useState<BPMNProcess | null>(null)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [apiModalVisible, setApiModalVisible] = useState(false)
  const [elementsModalVisible, setElementsModalVisible] = useState(false)
  const [xmlContent, setXmlContent] = useState<string>('')
  const [jsonContent, setJsonContent] = useState<any>(null)
  const [processElements, setProcessElements] = useState<any>(null)

  const { data: processes, loading, refetch } = useApi(
    () => bpmnApi.listBPMNProcesses({ page: 1, limit: 100 }),
    { immediate: true }
  )

  const { data: stats, refetch: refetchStats } = useApi(
    bpmnApi.getBPMNStats,
    { immediate: true }
  )

  const { mutate: uploadBPMN, loading: uploading } = useMutation(
    bpmnApi.parseBPMN,
    {
      onSuccess: () => {
        message.success('BPMN file uploaded successfully')
        refetch()
        refetchStats()
      }
    }
  )

  const { mutate: deleteProcess, loading: deleting } = useMutation(
    bpmnApi.deleteBPMNProcess,
    {
      onSuccess: () => {
        message.success('BPMN process deleted successfully')
        refetch()
        refetchStats()
      }
    }
  )

  const handleUpload = async (file: File) => {
    await uploadBPMN(file)
    return false
  }

  const handleDelete = async (id: string) => {
    await deleteProcess(id)
  }

  const handleViewXML = async (process: BPMNProcess) => {
    try {
      const xml = await bpmnApi.getBPMNProcessXML(process.key)
      setXmlContent(xml)
      setSelectedProcess(process)
      setViewModalVisible(true)
    } catch (error) {
      message.error('Failed to load BPMN XML')
    }
  }

  const handleViewDiagram = (process: BPMNProcess) => {
    navigate(`/bpmn/diagram/${process.key}`)
  }

  const handleViewJSON = async (process: BPMNProcess) => {
    try {
      const json = await bpmnApi.getBPMNProcessJSON(process.key)
      setJsonContent(json)
      setSelectedProcess(process)
      setViewModalVisible(true)
    } catch (error) {
      message.error('Failed to load BPMN JSON')
    }
  }

  const handleShowAPI = (process: BPMNProcess) => {
    setSelectedProcess(process)
    setApiModalVisible(true)
  }

  const handleViewElements = async (process: BPMNProcess) => {
    try {
      const json = await bpmnApi.getBPMNProcessJSON(process.key)
      const analyzed = analyzeProcessVariables(json)
      setProcessElements(analyzed)
      setSelectedProcess(process)
      setElementsModalVisible(true)
    } catch (error) {
      message.error('Failed to load process elements')
    }
  }

  const analyzeProcessVariables = (processData: any) => {
    const variables: any = {}
    const timers: any[] = []
    const conditions: any[] = []
    const tasks: any[] = []
    const messages: any[] = []
    
    if (processData.elements) {
      Object.entries(processData.elements).forEach(([elementId, element]: [string, any]) => {
        const elementType = element.type
        const elementName = element.name || elementId

        // Analyze timers
        if (element.time_duration || element.time_cycle || element.timer_event_definition) {
          timers.push({
            id: elementId,
            name: elementName,
            type: elementType,
            duration: element.time_duration,
            cycle: element.time_cycle,
            definition: element.timer_event_definition
          })
        }

        // Analyze conditions (gateways)
        if (element.condition_expression || elementType?.includes('Gateway')) {
          conditions.push({
            id: elementId,
            name: elementName,
            type: elementType,
            expression: element.condition_expression
          })
        }

        // Analyze tasks
        if (elementType?.includes('Task') || elementType === 'callActivity') {
          const taskInfo: any = {
            id: elementId,
            name: elementName,
            type: elementType,
            documentation: element.documentation?.[0],
            extensionElements: {}
          }

          // Parse extension elements for task configuration
          if (element.extension_elements) {
            element.extension_elements.forEach((ext: any) => {
              if (ext.extensions) {
                ext.extensions.forEach((extension: any) => {
                  if (extension.type === 'taskDefinition') {
                    taskInfo.extensionElements.taskDefinition = extension.attributes
                  }
                  if (extension.type === 'calledElement') {
                    taskInfo.extensionElements.calledElement = extension.called_element
                  }
                  if (extension.type === 'taskHeaders') {
                    taskInfo.extensionElements.taskHeaders = extension.headers
                  }
                  if (extension.type === 'ioMapping') {
                    taskInfo.extensionElements.ioMapping = extension
                  }
                })
              }
            })
          }

          tasks.push(taskInfo)
        }

        // Analyze messages
        if (element.message_event_definition || elementType?.includes('Message')) {
          messages.push({
            id: elementId,
            name: elementName,
            type: elementType,
            messageDefinition: element.message_event_definition,
            subscription: element.subscription
          })
        }
      })
    }

    return {
      ...processData,
      analyzed: {
        variables,
        timers,
        conditions,
        tasks,
        messages
      }
    }
  }

  const columns = [
    {
      title: 'PROCESS KEY',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => <Text strong>{key}</Text>,
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value: any, record: BPMNProcess) =>
        record.key.toLowerCase().includes(value.toLowerCase()) ||
        record.name.toLowerCase().includes(value.toLowerCase()) ||
        record.id.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'PROCESS ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: 'NAME',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'VERSION',
      dataIndex: 'version',
      key: 'version',
      render: (version: number) => <Tag color="blue">v{version}</Tag>,
    },
    {
      title: 'STATUS',
      dataIndex: ['metadata', 'status'],
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'green' : 'default'
        return <Tag color={color}>{status || 'unknown'}</Tag>
      },
    },
    {
      title: 'ELEMENTS',
      dataIndex: 'element_count',
      key: 'element_count',
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: 'CREATED',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 210,
      render: (_: any, record: BPMNProcess) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => handleViewDiagram(record)}
            title="View Diagram"
          />
          <Button
            type="text"
            size="small"
            icon={<DatabaseOutlined />}
            onClick={() => handleViewElements(record)}
            title="View Elements"
          />
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => handleShowAPI(record)}
            title="API Examples"
          />
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewJSON(record)}
            title="View JSON"
          />
          <Button
            type="text"
            size="small"
            icon={<CodeOutlined />}
            onClick={() => handleViewXML(record)}
            title="View XML"
          />
          <Popconfirm
            title="Delete BPMN Process"
            description="Are you sure you want to delete this process?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleting}
              title="Delete"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filteredProcesses = processes?.data || []

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>BPMN Parser</Title>
            <Text type="secondary">Upload, manage, and visualize BPMN processes</Text>
          </div>
          <Space>
            <Upload
              accept=".bpmn,.xml"
              beforeUpload={handleUpload}
              showUploadList={false}
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
              >
                Upload BPMN
              </Button>
            </Upload>
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
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Total Processes"
                value={stats?.total_processes || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Search */}
        <Card>
          <Search
            placeholder="Search by process key or name..."
            allowClear
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </Card>

        {/* Processes Table */}
        <Card title="BPMN Processes">
          <Table
            columns={columns}
            dataSource={filteredProcesses}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} processes`,
            }}
          />
        </Card>
      </Space>

      {/* View Modal */}
      <Modal
        title={`${selectedProcess?.name || 'Process'} - ${xmlContent ? 'XML' : 'JSON'}`}
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false)
          setXmlContent('')
          setJsonContent(null)
          setSelectedProcess(null)
        }}
        width={800}
        footer={null}
      >
        {xmlContent && (
          <pre style={{ 
            background: '#1f1f1f', 
            padding: '16px', 
            borderRadius: '4px',
            maxHeight: '500px',
            overflow: 'auto'
          }}>
            <code>{xmlContent}</code>
          </pre>
        )}
        {jsonContent && (
          <pre style={{ 
            background: '#1f1f1f', 
            padding: '16px', 
            borderRadius: '4px',
            maxHeight: '500px',
            overflow: 'auto'
          }}>
            <code>{JSON.stringify(jsonContent, null, 2)}</code>
          </pre>
        )}
      </Modal>

      {/* API Examples Modal */}
      <Modal
        title={`API Examples - ${selectedProcess?.name || 'Process'}`}
        open={apiModalVisible}
        onCancel={() => {
          setApiModalVisible(false)
          setSelectedProcess(null)
        }}
        width={900}
        footer={null}
      >
        {selectedProcess && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={5}>1. Start Process Instance</Title>
              <Text type="secondary">Start a new instance of this BPMN process</Text>
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '16px', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#e6e6e6' }}>{`curl -X POST http://localhost:27555/api/v1/processes \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -d '{
    "process_id": "${selectedProcess.id}",
    "variables": {
      "var1": "value1",
      "var2": 123
    }
  }'`}</code>
              </pre>
            </div>

            <div>
              <Title level={5}>2. Get Process Details</Title>
              <Text type="secondary">Retrieve detailed information about this process</Text>
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '16px', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#e6e6e6' }}>{`curl -X GET http://localhost:27555/api/v1/bpmn/processes/${selectedProcess.key} \\
  -H "X-API-Key: your-api-key-here"`}</code>
              </pre>
            </div>

            <div>
              <Title level={5}>3. Get Process JSON</Title>
              <Text type="secondary">Get parsed JSON representation</Text>
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '16px', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#e6e6e6' }}>{`curl -X GET http://localhost:27555/api/v1/bpmn/processes/${selectedProcess.key}/json \\
  -H "X-API-Key: your-api-key-here"`}</code>
              </pre>
            </div>

            <div>
              <Title level={5}>4. Get Process XML</Title>
              <Text type="secondary">Get original BPMN XML content</Text>
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '16px', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#e6e6e6' }}>{`curl -X GET http://localhost:27555/api/v1/bpmn/processes/${selectedProcess.key}/xml \\
  -H "X-API-Key: your-api-key-here"`}</code>
              </pre>
            </div>

            <div>
              <Title level={5}>5. Delete Process</Title>
              <Text type="secondary" style={{ color: '#ff4d4f' }}>Remove this process from storage</Text>
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '16px', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#e6e6e6' }}>{`curl -X DELETE http://localhost:27555/api/v1/bpmn/processes/${selectedProcess.id} \\
  -H "X-API-Key: your-api-key-here"`}</code>
              </pre>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: '#1f1f1f', borderRadius: '4px', border: '1px solid #333' }}>
              <Text strong style={{ color: '#e6e6e6' }}>Process Info:</Text>
              <ul style={{ marginTop: '8px', marginBottom: 0, color: '#e6e6e6' }}>
                <li><Text code style={{ background: '#2d2d2d', color: '#91d5ff', border: '1px solid #333' }}>Process Key:</Text> {selectedProcess.key}</li>
                <li><Text code style={{ background: '#2d2d2d', color: '#91d5ff', border: '1px solid #333' }}>Process ID:</Text> {selectedProcess.id}</li>
                <li><Text code style={{ background: '#2d2d2d', color: '#91d5ff', border: '1px solid #333' }}>Version:</Text> v{selectedProcess.version}</li>
                <li><Text code style={{ background: '#2d2d2d', color: '#91d5ff', border: '1px solid #333' }}>Status:</Text> {selectedProcess.metadata?.status || 'active'}</li>
                <li><Text code style={{ background: '#2d2d2d', color: '#91d5ff', border: '1px solid #333' }}>Elements:</Text> {selectedProcess.element_count}</li>
              </ul>
            </div>
          </Space>
        )}
      </Modal>

      {/* Process Variables & Configuration Modal */}
      <Modal
        title={`Process Configuration - ${selectedProcess?.name || 'Process'}`}
        open={elementsModalVisible}
        onCancel={() => {
          setElementsModalVisible(false)
          setProcessElements(null)
          setSelectedProcess(null)
        }}
        width={1200}
        footer={null}
      >
        {processElements?.analyzed && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Tasks Configuration */}
            {processElements.analyzed.tasks.length > 0 && (
              <div>
                <Title level={5} style={{ color: '#e6e6e6' }}>Tasks Configuration</Title>
                {processElements.analyzed.tasks.map((task: any) => (
                  <Card 
                    key={task.id} 
                    size="small"
                    style={{ 
                      background: '#1f1f1f', 
                      border: '1px solid #333',
                      marginBottom: '12px'
                    }}
                    title={
                      <Space>
                        <Tag color="blue">{task.type}</Tag>
                        <Text strong style={{ color: '#e6e6e6' }}>{task.name}</Text>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text style={{ color: '#91d5ff' }}>Element ID: </Text>
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #333' }}>
                          {task.id}
                        </Text>
                      </div>
                      
                      {task.documentation && (
                        <div>
                          <Text style={{ color: '#91d5ff' }}>Documentation: </Text>
                          <Text style={{ color: '#e6e6e6' }}>{task.documentation}</Text>
                        </div>
                      )}

                      {task.extensionElements.taskDefinition && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Task Definition:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              {JSON.stringify(task.extensionElements.taskDefinition, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}

                      {task.extensionElements.calledElement && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Called Process:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              Process ID: {task.extensionElements.calledElement.process_id}
                              {'\n'}Propagate Variables: {task.extensionElements.calledElement.propagate_all_child_variables ? 'Yes' : 'No'}
                            </code>
                          </pre>
                        </div>
                      )}

                      {task.extensionElements.taskHeaders && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Task Headers:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              {JSON.stringify(task.extensionElements.taskHeaders, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            {/* Timers Configuration */}
            {processElements.analyzed.timers.length > 0 && (
              <div>
                <Title level={5} style={{ color: '#e6e6e6' }}>Timers Configuration</Title>
                {processElements.analyzed.timers.map((timer: any) => (
                  <Card 
                    key={timer.id} 
                    size="small"
                    style={{ 
                      background: '#1f1f1f', 
                      border: '1px solid #333',
                      marginBottom: '12px'
                    }}
                    title={
                      <Space>
                        <Tag color="orange">{timer.type}</Tag>
                        <Text strong style={{ color: '#e6e6e6' }}>{timer.name}</Text>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text style={{ color: '#91d5ff' }}>Element ID: </Text>
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #333' }}>
                          {timer.id}
                        </Text>
                      </div>
                      
                      {timer.duration && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Duration: </Text>
                          <Text code style={{ background: '#2d2d2d', color: '#52c41a', border: '1px solid #333' }}>
                            {timer.duration}
                          </Text>
                        </div>
                      )}

                      {timer.cycle && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Cycle: </Text>
                          <Text code style={{ background: '#2d2d2d', color: '#52c41a', border: '1px solid #333' }}>
                            {timer.cycle}
                          </Text>
                        </div>
                      )}

                      {timer.definition && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Timer Definition:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              {JSON.stringify(timer.definition, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            {/* Gateway Conditions */}
            {processElements.analyzed.conditions.length > 0 && (
              <div>
                <Title level={5} style={{ color: '#e6e6e6' }}>Gateway Conditions</Title>
                {processElements.analyzed.conditions.map((condition: any) => (
                  <Card 
                    key={condition.id} 
                    size="small"
                    style={{ 
                      background: '#1f1f1f', 
                      border: '1px solid #333',
                      marginBottom: '12px'
                    }}
                    title={
                      <Space>
                        <Tag color="purple">{condition.type}</Tag>
                        <Text strong style={{ color: '#e6e6e6' }}>{condition.name}</Text>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text style={{ color: '#91d5ff' }}>Element ID: </Text>
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #333' }}>
                          {condition.id}
                        </Text>
                      </div>
                      
                      {condition.expression && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Condition Expression:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#ffa940', fontSize: '12px' }}>
                              {typeof condition.expression === 'string' 
                                ? condition.expression 
                                : JSON.stringify(condition.expression, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            {/* Messages Configuration */}
            {processElements.analyzed.messages.length > 0 && (
              <div>
                <Title level={5} style={{ color: '#e6e6e6' }}>Messages Configuration</Title>
                {processElements.analyzed.messages.map((msg: any) => (
                  <Card 
                    key={msg.id} 
                    size="small"
                    style={{ 
                      background: '#1f1f1f', 
                      border: '1px solid #333',
                      marginBottom: '12px'
                    }}
                    title={
                      <Space>
                        <Tag color="cyan">{msg.type}</Tag>
                        <Text strong style={{ color: '#e6e6e6' }}>{msg.name}</Text>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text style={{ color: '#91d5ff' }}>Element ID: </Text>
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #333' }}>
                          {msg.id}
                        </Text>
                      </div>
                      
                      {msg.messageDefinition && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Message Definition:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              {JSON.stringify(msg.messageDefinition, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}

                      {msg.subscription && (
                        <div>
                          <Text strong style={{ color: '#91d5ff' }}>Subscription:</Text>
                          <pre style={{ 
                            background: '#2d2d2d', 
                            padding: '8px', 
                            borderRadius: '4px',
                            border: '1px solid #434343',
                            marginTop: '4px'
                          }}>
                            <code style={{ color: '#52c41a', fontSize: '12px' }}>
                              {JSON.stringify(msg.subscription, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            {/* Summary */}
            <Card size="small" style={{ background: '#1f1f1f', border: '1px solid #333' }}>
              <Title level={5} style={{ color: '#e6e6e6', marginTop: 0 }}>Summary</Title>
              <Space size="large" wrap>
                <Statistic
                  title={<span style={{ color: '#91d5ff' }}>Tasks</span>}
                  value={processElements.analyzed.tasks.length}
                  valueStyle={{ color: '#1890ff' }}
                />
                <Statistic
                  title={<span style={{ color: '#91d5ff' }}>Timers</span>}
                  value={processElements.analyzed.timers.length}
                  valueStyle={{ color: '#faad14' }}
                />
                <Statistic
                  title={<span style={{ color: '#91d5ff' }}>Conditions</span>}
                  value={processElements.analyzed.conditions.length}
                  valueStyle={{ color: '#722ed1' }}
                />
                <Statistic
                  title={<span style={{ color: '#91d5ff' }}>Messages</span>}
                  value={processElements.analyzed.messages.length}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Space>
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default BpmnPage
