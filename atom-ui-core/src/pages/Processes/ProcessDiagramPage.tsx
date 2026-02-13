import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Typography, Tag, Spin, message, Collapse, Descriptions, Badge, Switch, Tooltip } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, ClockCircleOutlined, ThunderboltOutlined, EnvironmentOutlined, HistoryOutlined, InfoCircleOutlined, EyeInvisibleOutlined, SyncOutlined } from '@ant-design/icons'
import * as processesApi from '../../api/endpoints/processes'
import * as bpmnApi from '../../api/endpoints/bpmn'
import * as timersApi from '../../api/endpoints/timers'
import * as jobsApi from '../../api/endpoints/jobs'
import BpmnViewerComponent from '../../components/BpmnViewer'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'

dayjs.extend(relativeTime)
dayjs.extend(duration)

const { Title, Text } = Typography

const ProcessDiagramPage = () => {
  const { instanceId } = useParams<{ instanceId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [xmlContent, setXmlContent] = useState<string>('')
  const [processInstance, setProcessInstance] = useState<any>(null)
  const [activeTokens, setActiveTokens] = useState<any[]>([])
  const [tokenTrace, setTokenTrace] = useState<any[]>([])
  const [timers, setTimers] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [bpmnElements, setBpmnElements] = useState<Map<string, any>>(new Map())
  const [showHistory, setShowHistory] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (instanceId) {
      loadDiagram()
    }
  }, [instanceId])

  useEffect(() => {
    if (!autoRefresh || !instanceId || loading) return
    
    // Stop auto-refresh if process is completed or cancelled
    if (processInstance && (processInstance.state === 'COMPLETED' || processInstance.state === 'CANCELLED')) {
      return
    }

    const interval = setInterval(() => {
      refreshTokens(true) // Silent refresh
    }, 1000) // Refresh every second

    return () => clearInterval(interval)
  }, [autoRefresh, instanceId, loading, processInstance?.state])

  useEffect(() => {
    // Update "X seconds ago" display every second
    const interval = setInterval(() => {
      setTick(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const loadDiagram = async () => {
    try {
      setLoading(true)
      
      const instance = await processesApi.getProcessStatus(instanceId!)
      setProcessInstance(instance)
      
      const [bpmnProcesses, tokensResponse, traceResponse, timersResponse, jobsResponse] = await Promise.all([
        bpmnApi.listBPMNProcesses({ page: 1, limit: 100 }),
        processesApi.getProcessTokens(instanceId!),
        processesApi.getTokenTrace(instanceId!).catch(() => ({ data: [] })),
        timersApi.listTimers({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
        jobsApi.listJobs({ page: 1, limit: 100 }).catch(() => ({ data: [] }))
      ])
      
      const bpmnProcess = bpmnProcesses.data.find((p: any) => p.id === instance.process_id)
      
      if (!bpmnProcess) {
        throw new Error(`BPMN process not found for process_id: ${instance.process_id}`)
      }
      
      const xml = await bpmnApi.getBPMNProcessXML(bpmnProcess.key)
      setXmlContent(xml)
      
      // Parse BPMN to get element information
      parseBpmnElements(xml)
      
      
      // Filter timers and jobs for this process instance
      const tokenElementIds = new Set(tokensResponse.data?.map((t: any) => t.element_id) || [])
      
      const processTimers = timersResponse.data?.filter((t: any) => 
        t.process_instance_id === instanceId && 
        t.remaining_seconds !== undefined && 
        t.remaining_seconds >= 0
      ) || []
      
      const processJobs = jobsResponse.data?.filter((j: any) => 
        j.process_instance_id === instanceId
      ) || []
      
      setTimers(processTimers)
      setJobs(processJobs)
      setActiveTokens(tokensResponse.data || [])
      setTokenTrace(traceResponse.data || [])
    } catch (error) {
      message.error('Failed to load process diagram')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getTokenInfo = (token: any) => {
    const elementInfo = bpmnElements.get(token.element_id)
    const timer = timers.find(t => t.element_id === token.element_id)
    const job = jobs.find(j => j.element_id === token.element_id)
    
    // If this is a boundary event, also get info about the parent element
    let parentElement = null
    if (elementInfo?.attachedToRef) {
      parentElement = bpmnElements.get(elementInfo.attachedToRef)
    }
    
    return {
      token,
      element: elementInfo,
      parentElement,
      timer,
      job
    }
  }

  const getBoundaryTokens = () => {
    const tokensToShow = showHistory ? tokenTrace : activeTokens
    return tokensToShow.filter((token: any) => {
      const element = bpmnElements.get(token.element_id)
      return element?.isBoundary
    })
  }

  const getMainTokens = () => {
    const tokensToShow = showHistory ? tokenTrace : activeTokens
    return tokensToShow.filter((token: any) => {
      const element = bpmnElements.get(token.element_id)
      return !element?.isBoundary
    })
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 0) return 'Expired'
    if (seconds === 0) return '0s'
    
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (mins > 0) parts.push(`${mins}m`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
    
    return parts.join(' ')
  }

  const parseBpmnElements = (xmlString: string) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
      const elementsMap = new Map<string, any>()
      
      // Parse all flow nodes including boundary events
      const flowNodes = xmlDoc.querySelectorAll('startEvent, endEvent, task, serviceTask, userTask, scriptTask, sendTask, receiveTask, businessRuleTask, manualTask, intermediateThrowEvent, intermediateCatchEvent, boundaryEvent, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway, complexGateway')
      
      flowNodes.forEach((node: any) => {
        const id = node.getAttribute('id')
        const name = node.getAttribute('name')
        const type = node.nodeName
        const attachedToRef = node.getAttribute('attachedToRef') // For boundary events
        const cancelActivity = node.getAttribute('cancelActivity') // interrupting = true
        
        let timerInfo = null
        let eventType = null
        
        // Check for timer event definition
        const timerEventDef = node.querySelector('timerEventDefinition')
        if (timerEventDef) {
          const timeDuration = timerEventDef.querySelector('timeDuration')
          const timeCycle = timerEventDef.querySelector('timeCycle')
          const timeDate = timerEventDef.querySelector('timeDate')
          
          timerInfo = {
            duration: timeDuration?.textContent || null,
            cycle: timeCycle?.textContent || null,
            date: timeDate?.textContent || null
          }
          eventType = 'timer'
        }
        
        // Check for other event types
        if (node.querySelector('messageEventDefinition')) eventType = 'message'
        if (node.querySelector('errorEventDefinition')) eventType = 'error'
        if (node.querySelector('signalEventDefinition')) eventType = 'signal'
        if (node.querySelector('escalationEventDefinition')) eventType = 'escalation'
        
        const elementInfo: any = {
          id,
          name: name || id,
          type,
          timerInfo,
          eventType
        }
        
        // Add boundary event specific info
        if (type === 'boundaryEvent' && attachedToRef) {
          elementInfo.attachedToRef = attachedToRef
          elementInfo.cancelActivity = cancelActivity !== 'false' // default is true (interrupting)
          elementInfo.isBoundary = true
        }
        
        elementsMap.set(id, elementInfo)
      })
      
      setBpmnElements(elementsMap)
    } catch (err) {
      console.error('Error parsing BPMN:', err)
    }
  }

  const handleBack = () => {
    navigate('/processes')
  }

  const refreshTokens = async (silent = false) => {
    try {
      const [instanceStatus, tokensResponse, traceResponse, timersResponse, jobsResponse] = await Promise.all([
        processesApi.getProcessStatus(instanceId!),
        processesApi.getProcessTokens(instanceId!),
        processesApi.getTokenTrace(instanceId!).catch(() => ({ data: [] })),
        timersApi.listTimers({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
        jobsApi.listJobs({ page: 1, limit: 100 }).catch(() => ({ data: [] }))
      ])
      
      const processTimers = timersResponse.data?.filter((t: any) => 
        t.process_instance_id === instanceId && 
        t.remaining_seconds !== undefined && 
        t.remaining_seconds >= 0
      ) || []
      
      const processJobs = jobsResponse.data?.filter((j: any) => 
        j.process_instance_id === instanceId
      ) || []
      
      // Check if state changed
      const stateChanged = processInstance && processInstance.state !== instanceStatus.state
      
      setProcessInstance(instanceStatus)
      setActiveTokens(tokensResponse.data || [])
      setTokenTrace(traceResponse.data || [])
      setTimers(processTimers)
      setJobs(processJobs)
      setLastUpdate(new Date())
      
      if (!silent) {
        const msg = `Refreshed: ${tokensResponse.data?.length || 0} tokens, ${processTimers.length} timers, ${processJobs.length} jobs`
        message.success(msg)
      } else if (stateChanged) {
        // Notify about state change even in silent mode
        message.info(`Process state changed: ${processInstance.state} → ${instanceStatus.state}`, 3)
      }
    } catch (error) {
      if (!silent) {
        message.error('Failed to refresh data')
      }
      console.error('Refresh error:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 'calc(100vh - 200px)',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spin size="large" />
        <Text>Loading process diagram...</Text>
      </div>
    )
  }

  return (
    <div style={{ 
      height: '100%',
      padding: '0 4px 16px 4px',
      maxWidth: '100%',
      overflow: 'auto'
    }}>
      {/* Header */}
      <Card 
        size="small" 
        style={{ marginBottom: '8px' }}
        styles={{ body: { padding: '8px 12px' } }}
      >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {/* Top row - buttons and title */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              size="small"
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => refreshTokens(false)}
              size="small"
            />
            <Space size="small">
              <Switch 
                size="small"
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren={<SyncOutlined spin />}
                unCheckedChildren={<SyncOutlined />}
              />
              <Text style={{ fontSize: '11px' }}>Auto</Text>
            </Space>
            {lastUpdate && autoRefresh && processInstance?.state === 'ACTIVE' && (
              <Badge 
                status="processing" 
                text={
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s
                  </Text>
                }
              />
            )}
            {processInstance && (processInstance.state === 'COMPLETED' || processInstance.state === 'CANCELLED') && (
              <Badge 
                status={processInstance.state === 'COMPLETED' ? 'success' : 'error'}
                text={
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    {processInstance.state}
                  </Text>
                }
              />
            )}
            <Space size="small">
              <Switch 
                size="small"
                checked={showHistory}
                onChange={setShowHistory}
                checkedChildren={<HistoryOutlined />}
                unCheckedChildren={<HistoryOutlined />}
              />
              <Text style={{ fontSize: '11px' }}>History</Text>
            </Space>
            <Space size="small">
              <Switch 
                size="small"
                checked={showDetails}
                onChange={setShowDetails}
                checkedChildren={<InfoCircleOutlined />}
                unCheckedChildren={<InfoCircleOutlined />}
              />
              <Text style={{ fontSize: '11px' }}>Details</Text>
            </Space>
            <Title level={5} style={{ margin: 0, fontSize: '16px', flex: 1, minWidth: '150px' }}>
              {processInstance?.process_name || 'Process Diagram'}
            </Title>
          </div>
          
          {/* Bottom row - process info */}
          {processInstance && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '8px 12px',
              fontSize: '13px'
            }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Instance</Text>
                <Text code style={{ fontSize: '10px' }}>{processInstance.instance_id.substring(0, 10)}...</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Process</Text>
                <Text code style={{ fontSize: '10px' }}>{processInstance.process_id}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>State</Text>
                <Tag 
                  style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}
                  color={
                    processInstance.state === 'ACTIVE' ? 'processing' :
                    processInstance.state === 'COMPLETED' ? 'success' :
                    processInstance.state === 'CANCELLED' ? 'error' : 'default'
                  }
                >
                  {processInstance.state}
                </Tag>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Tokens</Text>
                <Space size={2}>
                  <Tag color="blue" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                    {getMainTokens().length}
                  </Tag>
                  {getBoundaryTokens().length > 0 && (
                    <Tag color="orange" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                      +{getBoundaryTokens().length}B
                    </Tag>
                  )}
                </Space>
              </div>
              {(timers.length > 0 || jobs.length > 0) && (
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Activity</Text>
                  <Space size={2}>
                    {timers.filter(t => t.status === 'SCHEDULED' || t.status === 'PENDING').length > 0 && (
                      <Tag color="blue" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                        {timers.filter(t => t.status === 'SCHEDULED' || t.status === 'PENDING').length}⏰
                      </Tag>
                    )}
                    {jobs.length > 0 && (
                      <Tag color="purple" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                        {jobs.length}⚡
                      </Tag>
                    )}
                  </Space>
                </div>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Started</Text>
                <Text style={{ fontSize: '11px' }}>{dayjs(processInstance.started_at * 1000).format('DD.MM HH:mm')}</Text>
              </div>
              {processInstance.completed_at && (
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Completed</Text>
                  <Text style={{ fontSize: '11px' }}>{dayjs(processInstance.completed_at * 1000).format('DD.MM HH:mm')}</Text>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Compact Tokens Summary */}
      {!showDetails && (() => {
        const tokensToShow = showHistory ? tokenTrace : activeTokens
        const mainTokensFiltered = tokensToShow.filter((token: any) => {
          const element = bpmnElements.get(token.element_id)
          return !element?.isBoundary
        })
        const boundaryTokensFiltered = tokensToShow.filter((token: any) => {
          const element = bpmnElements.get(token.element_id)
          return element?.isBoundary
        })
        
        if (tokensToShow.length === 0) return null
        
        return (
          <Card 
            size="small" 
            style={{ marginBottom: '8px' }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <Space wrap style={{ width: '100%' }}>
              <Text strong style={{ fontSize: '13px' }}>
                {showHistory ? 'Tokens (All)' : 'Tokens (Active)'}: {tokensToShow.length}
              </Text>
              {mainTokensFiltered.slice(0, 5).map((token: any, idx: number) => {
                const info = getTokenInfo(token)
                return (
                  <Tag 
                    key={token.id}
                    color={token.state === 'ACTIVE' ? 'processing' : token.state === 'COMPLETED' ? 'success' : 'default'}
                    style={{ fontSize: '11px', margin: 0 }}
                  >
                    {info.element?.name || token.element_id}
                    {showHistory && ` [${token.state}]`}
                  </Tag>
                )
              })}
              {mainTokensFiltered.length > 5 && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  +{mainTokensFiltered.length - 5} more
                </Text>
              )}
              {boundaryTokensFiltered.length > 0 && (
                <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                  + {boundaryTokensFiltered.length} boundary
                </Text>
              )}
            </Space>
          </Card>
        )
      })()}

      {/* Compact Summary - Timers and Jobs */}
      {!showDetails && (timers.length > 0 || jobs.length > 0) && (
        <Card 
          size="small" 
          style={{ marginBottom: '8px' }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {/* Timers */}
            {(() => {
              const scheduledTimers = timers.filter(t => t.status === 'SCHEDULED' || t.status === 'PENDING')
              if (scheduledTimers.length === 0) return null
              
              return (
                <Space wrap style={{ width: '100%' }}>
                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: '13px' }}>
                    Timers: {scheduledTimers.length}
                  </Text>
                  {scheduledTimers.slice(0, 3).map((timer: any, idx: number) => {
                    const elementInfo = bpmnElements.get(timer.element_id)
                    return (
                      <Tag 
                        key={timer.timer_id}
                        color="blue"
                        style={{ fontSize: '11px', margin: 0 }}
                      >
                        {elementInfo?.name || timer.element_id}
                        {timer.remaining_seconds !== undefined && 
                          ` (${formatDuration(timer.remaining_seconds)})`
                        }
                      </Tag>
                    )
                  })}
                  {scheduledTimers.length > 3 && (
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      +{scheduledTimers.length - 3} more
                    </Text>
                  )}
                </Space>
              )
            })()}
            
            {/* Jobs */}
            {jobs.length > 0 && (
              <Space wrap style={{ width: '100%' }}>
                <ThunderboltOutlined style={{ color: '#722ed1' }} />
                <Text strong style={{ fontSize: '13px' }}>
                  Jobs: {jobs.length}
                </Text>
                {jobs.slice(0, 3).map((job: any, idx: number) => {
                  const elementInfo = bpmnElements.get(job.element_id)
                  return (
                    <Tag 
                      key={job.key}
                      color="purple"
                      style={{ fontSize: '11px', margin: 0 }}
                    >
                      {job.type} @ {elementInfo?.name || job.element_id}
                    </Tag>
                  )
                })}
                {jobs.length > 3 && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    +{jobs.length - 3} more
                  </Text>
                )}
              </Space>
            )}
          </Space>
        </Card>
      )}

      {/* Tokens Detailed Info */}
      {showDetails && (() => {
        const tokensToShow = showHistory ? tokenTrace : activeTokens
        const mainTokens = getMainTokens()
        const boundaryTokens = getBoundaryTokens()
        
        if (tokensToShow.length === 0) return null
        
        return (
          <Card 
            size="small" 
            style={{ marginBottom: '8px' }}
            styles={{ body: { padding: '8px 12px' } }}
            title={
              <Space>
                <Text strong style={{ fontSize: '14px' }}>
                  {showHistory ? 'All Tokens' : 'Active Tokens'} ({tokensToShow.length})
                </Text>
                {showHistory && activeTokens.length < tokensToShow.length && (
                  <Tag color="processing" style={{ fontSize: '11px' }}>
                    Active: {activeTokens.length}
                  </Tag>
                )}
                {boundaryTokens.length > 0 && (
                  <Tag color="orange" style={{ fontSize: '11px' }}>
                    Boundary: {boundaryTokens.length}
                  </Tag>
                )}
              </Space>
            }
          >
            {/* Main Tokens */}
            {mainTokens.length > 0 && (
              <>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  Main Flow Tokens ({mainTokens.length})
                </Text>
                <Collapse 
                  size="small"
                  defaultActiveKey={[]}
                  style={{ marginBottom: boundaryTokens.length > 0 ? '16px' : 0 }}
                  items={mainTokens.map((token: any, idx: number) => {
              const info = getTokenInfo(token)
              const elementName = info.element?.name || token.element_id
              const elementType = info.element?.type || 'unknown'
              
              return {
                key: token.id,
                label: (
                  <Space size="small">
                    <Badge 
                      count={idx + 1} 
                      style={{ backgroundColor: token.state === 'ACTIVE' ? '#52c41a' : '#faad14' }}
                    />
                    <Text strong style={{ fontSize: '12px' }}>{elementName}</Text>
                    <Tag style={{ fontSize: '10px', margin: 0 }}>{elementType}</Tag>
                    {info.timer && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
                    {info.job && <ThunderboltOutlined style={{ color: '#722ed1' }} />}
                    <Tag 
                      color={token.state === 'ACTIVE' ? 'processing' : 'default'}
                      style={{ fontSize: '10px', margin: 0 }}
                    >
                      {token.state}
                    </Tag>
                  </Space>
                ),
                children: (
                  <div style={{ fontSize: '12px' }}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Token ID">
                        <Text code style={{ fontSize: '11px' }}>{token.id}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Element ID">
                        <Space>
                          <EnvironmentOutlined />
                          <Text code style={{ fontSize: '11px' }}>{token.element_id}</Text>
                        </Space>
                      </Descriptions.Item>
                      {info.element?.name && (
                        <Descriptions.Item label="Element Name">
                          {info.element.name}
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Element Type">
                        <Space size="small">
                          <Tag>{elementType}</Tag>
                          {info.element?.isBoundary && (
                            <Tag color={info.element.cancelActivity ? 'red' : 'blue'}>
                              {info.element.cancelActivity ? 'Interrupting' : 'Non-interrupting'}
                            </Tag>
                          )}
                          {info.element?.eventType && (
                            <Tag color="purple">{info.element.eventType}</Tag>
                          )}
                        </Space>
                      </Descriptions.Item>
                      {info.element?.attachedToRef && (
                        <Descriptions.Item label="Attached To">
                          <Text code style={{ fontSize: '11px' }}>{info.element.attachedToRef}</Text>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Created">
                        {dayjs(token.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '11px' }}>
                          ({dayjs(token.created_at * 1000).fromNow()})
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>

                    {/* Timer Information */}
                    {info.timer && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={
                          <Space>
                            <ClockCircleOutlined style={{ color: '#1890ff' }} />
                            <Text strong style={{ fontSize: '12px' }}>Timer Information</Text>
                          </Space>
                        }
                      >
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Timer Type">
                            <Tag color="blue">{info.timer.timer_type}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Status">
                            <Tag color={info.timer.status === 'PENDING' ? 'processing' : 'default'}>
                              {info.timer.status}
                            </Tag>
                          </Descriptions.Item>
                          {info.timer.time_duration && (
                            <Descriptions.Item label="Duration">
                              <Text code>{info.timer.time_duration}</Text>
                            </Descriptions.Item>
                          )}
                          {info.timer.time_cycle && (
                            <Descriptions.Item label="Cycle">
                              <Text code>{info.timer.time_cycle}</Text>
                            </Descriptions.Item>
                          )}
                          {info.timer.remaining_seconds !== undefined && (
                            <Descriptions.Item label="Remaining">
                              <Text strong style={{ color: info.timer.remaining_seconds < 60 ? '#ff4d4f' : '#52c41a' }}>
                                {formatDuration(info.timer.remaining_seconds)}
                              </Text>
                            </Descriptions.Item>
                          )}
                          <Descriptions.Item label="Scheduled At">
                            {dayjs(info.timer.scheduled_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    )}

                    {/* Job Information */}
                    {info.job && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={
                          <Space>
                            <ThunderboltOutlined style={{ color: '#722ed1' }} />
                            <Text strong style={{ fontSize: '12px' }}>Job Information</Text>
                          </Space>
                        }
                      >
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Job Type">
                            <Tag color="purple">{info.job.type}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="State">
                            <Tag color={info.job.state === 'ACTIVATABLE' ? 'processing' : 'default'}>
                              {info.job.state}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Retries">
                            <Badge count={info.job.retries} showZero style={{ backgroundColor: '#52c41a' }} />
                          </Descriptions.Item>
                          {info.job.worker && (
                            <Descriptions.Item label="Worker">
                              <Text code>{info.job.worker}</Text>
                            </Descriptions.Item>
                          )}
                          {info.job.deadline && (
                            <Descriptions.Item label="Deadline">
                              {dayjs(info.job.deadline * 1000).format('YYYY-MM-DD HH:mm:ss')}
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                      </Card>
                    )}

                    {/* BPMN Element Info */}
                    {info.element?.timerInfo && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={<Text strong style={{ fontSize: '12px' }}>BPMN Timer Definition</Text>}
                      >
                        <Descriptions column={1} size="small">
                          {info.element.timerInfo.duration && (
                            <Descriptions.Item label="Duration">
                              <Text code>{info.element.timerInfo.duration}</Text>
                            </Descriptions.Item>
                          )}
                          {info.element.timerInfo.cycle && (
                            <Descriptions.Item label="Cycle">
                              <Text code>{info.element.timerInfo.cycle}</Text>
                            </Descriptions.Item>
                          )}
                          {info.element.timerInfo.date && (
                            <Descriptions.Item label="Date">
                              <Text code>{info.element.timerInfo.date}</Text>
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                      </Card>
                    )}

                    {/* Variables */}
                    {token.variables && Object.keys(token.variables).length > 0 && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={<Text strong style={{ fontSize: '12px' }}>Variables</Text>}
                      >
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '11px',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(token.variables, null, 2)}
                        </pre>
                      </Card>
                    )}
                  </div>
                )
              }
            })}
                />
              </>
            )}
            
            {/* Boundary Tokens */}
            {boundaryTokens.length > 0 && (
              <>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  Boundary Event Tokens ({boundaryTokens.length})
                </Text>
                <Collapse 
                  size="small"
                  defaultActiveKey={[]}
                  items={boundaryTokens.map((token: any, idx: number) => {
                    const info = getTokenInfo(token)
                    const elementName = info.element?.name || token.element_id
                    const elementType = info.element?.type || 'unknown'
                    
                    return {
                      key: token.id,
                      label: (
                        <Space size="small">
                          <Badge 
                            count={`B${idx + 1}`} 
                            style={{ backgroundColor: token.state === 'ACTIVE' ? '#fa8c16' : '#d9d9d9' }}
                          />
                          <Text strong style={{ fontSize: '12px' }}>{elementName}</Text>
                          <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>Boundary</Tag>
                          {info.element?.cancelActivity === false && (
                            <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>Non-interrupting</Tag>
                          )}
                          {info.element?.eventType && (
                            <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>{info.element.eventType}</Tag>
                          )}
                          {info.timer && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
                          <Tag 
                            color={token.state === 'ACTIVE' ? 'processing' : 'default'}
                            style={{ fontSize: '10px', margin: 0 }}
                          >
                            {token.state}
                          </Tag>
                        </Space>
                      ),
                      children: (
                        <div style={{ fontSize: '12px' }}>
                          {info.parentElement && (
                            <Card 
                              size="small" 
                              style={{ marginBottom: '8px', background: '#fafafa' }}
                              title={
                                <Space>
                                  <Text strong style={{ fontSize: '12px' }}>Attached To</Text>
                                </Space>
                              }
                            >
                              <Descriptions column={1} size="small">
                                <Descriptions.Item label="Parent Element">
                                  <Text code style={{ fontSize: '11px' }}>{info.element.attachedToRef}</Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Parent Name">
                                  {info.parentElement.name}
                                </Descriptions.Item>
                                <Descriptions.Item label="Parent Type">
                                  <Tag>{info.parentElement.type}</Tag>
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          )}
                          
                          <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="Token ID">
                              <Text code style={{ fontSize: '11px' }}>{token.id}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Element ID">
                              <Space>
                                <EnvironmentOutlined />
                                <Text code style={{ fontSize: '11px' }}>{token.element_id}</Text>
                              </Space>
                            </Descriptions.Item>
                            {info.element?.name && (
                              <Descriptions.Item label="Element Name">
                                {info.element.name}
                              </Descriptions.Item>
                            )}
                            <Descriptions.Item label="Element Type">
                              <Space size="small">
                                <Tag>{elementType}</Tag>
                                {info.element?.isBoundary && (
                                  <Tag color={info.element.cancelActivity ? 'red' : 'blue'}>
                                    {info.element.cancelActivity ? 'Interrupting' : 'Non-interrupting'}
                                  </Tag>
                                )}
                                {info.element?.eventType && (
                                  <Tag color="purple">{info.element.eventType}</Tag>
                                )}
                              </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Created">
                              {dayjs(token.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                ({dayjs(token.created_at * 1000).fromNow()})
                              </Text>
                            </Descriptions.Item>
                          </Descriptions>

                          {/* Timer Information for Boundary */}
                          {info.timer && (
                            <Card 
                              size="small" 
                              style={{ marginTop: '8px' }}
                              title={
                                <Space>
                                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                                  <Text strong style={{ fontSize: '12px' }}>Timer Information</Text>
                                </Space>
                              }
                            >
                              <Descriptions column={1} size="small">
                                <Descriptions.Item label="Timer Type">
                                  <Tag color="blue">{info.timer.timer_type}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Status">
                                  <Tag color={info.timer.status === 'PENDING' ? 'processing' : 'default'}>
                                    {info.timer.status}
                                  </Tag>
                                </Descriptions.Item>
                                {info.timer.time_duration && (
                                  <Descriptions.Item label="Duration">
                                    <Text code>{info.timer.time_duration}</Text>
                                  </Descriptions.Item>
                                )}
                                {info.timer.time_cycle && (
                                  <Descriptions.Item label="Cycle">
                                    <Text code>{info.timer.time_cycle}</Text>
                                  </Descriptions.Item>
                                )}
                                {info.timer.remaining_seconds !== undefined && (
                                  <Descriptions.Item label="Remaining">
                                    <Text strong style={{ color: info.timer.remaining_seconds < 60 ? '#ff4d4f' : '#52c41a' }}>
                                      {formatDuration(info.timer.remaining_seconds)}
                                    </Text>
                                  </Descriptions.Item>
                                )}
                                <Descriptions.Item label="Scheduled At">
                                  {dayjs(info.timer.scheduled_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          )}

                          {/* BPMN Timer Definition */}
                          {info.element?.timerInfo && (
                            <Card 
                              size="small" 
                              style={{ marginTop: '8px' }}
                              title={<Text strong style={{ fontSize: '12px' }}>BPMN Timer Definition</Text>}
                            >
                              <Descriptions column={1} size="small">
                                {info.element.timerInfo.duration && (
                                  <Descriptions.Item label="Duration">
                                    <Text code>{info.element.timerInfo.duration}</Text>
                                  </Descriptions.Item>
                                )}
                                {info.element.timerInfo.cycle && (
                                  <Descriptions.Item label="Cycle">
                                    <Text code>{info.element.timerInfo.cycle}</Text>
                                  </Descriptions.Item>
                                )}
                                {info.element.timerInfo.date && (
                                  <Descriptions.Item label="Date">
                                    <Text code>{info.element.timerInfo.date}</Text>
                                  </Descriptions.Item>
                                )}
                              </Descriptions>
                            </Card>
                          )}

                          {/* Variables */}
                          {token.variables && Object.keys(token.variables).length > 0 && (
                            <Card 
                              size="small" 
                              style={{ marginTop: '8px' }}
                              title={<Text strong style={{ fontSize: '12px' }}>Variables</Text>}
                            >
                              <pre style={{ 
                                margin: 0, 
                                fontSize: '11px',
                                maxHeight: '150px',
                                overflow: 'auto'
                              }}>
                                {JSON.stringify(token.variables, null, 2)}
                              </pre>
                            </Card>
                          )}
                        </div>
                      )
                    }
                  })}
                />
              </>
            )}
          </Card>
        )
      })()}
      
      {showDetails && activeTokens.length === 0 && !showHistory && !loading && (
        <Card 
          size="small" 
          style={{ marginBottom: '8px' }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Text type="warning" style={{ fontSize: '13px' }}>No tokens found. Process may be waiting or completed.</Text>
        </Card>
      )}

      {/* Active Timers Info */}
      {showDetails && timers.length > 0 && (() => {
        const scheduledCount = timers.filter(t => t.status === 'SCHEDULED' || t.status === 'PENDING').length
        const firedCount = timers.filter(t => t.status === 'FIRED').length
        const cancelledCount = timers.filter(t => t.status === 'CANCELLED').length
        
        return (
          <Card 
            size="small" 
            style={{ marginBottom: '8px' }}
            styles={{ body: { padding: '8px 12px' } }}
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ fontSize: '14px' }}>Timers ({timers.length})</Text>
                <Tag color="processing" style={{ fontSize: '11px' }}>Active: {scheduledCount}</Tag>
                {firedCount > 0 && <Tag color="success" style={{ fontSize: '11px' }}>Fired: {firedCount}</Tag>}
                {cancelledCount > 0 && <Tag color="default" style={{ fontSize: '11px' }}>Cancelled: {cancelledCount}</Tag>}
              </Space>
            }
          >
          <Collapse 
            size="small"
            defaultActiveKey={[]}
            items={timers.map((timer: any, idx: number) => {
              const elementInfo = bpmnElements.get(timer.element_id)
              const timerToken = activeTokens.find((t: any) => t.element_id === timer.element_id)
              
              return {
                key: timer.timer_id,
                label: (
                  <Space size="small">
                    <Badge 
                      count={idx + 1} 
                      style={{ backgroundColor: '#1890ff' }}
                    />
                    <ClockCircleOutlined style={{ color: '#1890ff' }} />
                    <Text strong style={{ fontSize: '12px' }}>{elementInfo?.name || timer.element_id}</Text>
                    <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>{timer.timer_type}</Tag>
                    <Tag 
                      color={timer.status === 'PENDING' ? 'processing' : 'default'}
                      style={{ fontSize: '10px', margin: 0 }}
                    >
                      {timer.status}
                    </Tag>
                    {timer.remaining_seconds !== undefined && (
                      <Text strong style={{ 
                        fontSize: '11px',
                        color: timer.remaining_seconds < 60 ? '#ff4d4f' : '#52c41a' 
                      }}>
                        {formatDuration(timer.remaining_seconds)}
                      </Text>
                    )}
                  </Space>
                ),
                children: (
                  <div style={{ fontSize: '12px' }}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Timer ID">
                        <Text code style={{ fontSize: '11px' }}>{timer.timer_id}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Element ID">
                        <Text code style={{ fontSize: '11px' }}>{timer.element_id}</Text>
                      </Descriptions.Item>
                      {elementInfo?.name && (
                        <Descriptions.Item label="Element Name">
                          {elementInfo.name}
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Timer Type">
                        <Tag color="blue">{timer.timer_type}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color={timer.status === 'PENDING' ? 'processing' : 'default'}>
                          {timer.status}
                        </Tag>
                      </Descriptions.Item>
                      {timer.time_duration && (
                        <Descriptions.Item label="Duration">
                          <Text code>{timer.time_duration}</Text>
                        </Descriptions.Item>
                      )}
                      {timer.time_cycle && (
                        <Descriptions.Item label="Cycle">
                          <Text code>{timer.time_cycle}</Text>
                        </Descriptions.Item>
                      )}
                      {timer.remaining_seconds !== undefined && (
                        <Descriptions.Item label="Remaining">
                          <Text strong style={{ 
                            color: timer.remaining_seconds < 60 ? '#ff4d4f' : '#52c41a' 
                          }}>
                            {formatDuration(timer.remaining_seconds)}
                          </Text>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Scheduled At">
                        {dayjs(timer.scheduled_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '11px' }}>
                          ({dayjs(timer.scheduled_at * 1000).fromNow()})
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Created At">
                        {dayjs(timer.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                      </Descriptions.Item>
                      {elementInfo?.isBoundary && (
                        <>
                          <Descriptions.Item label="Boundary Event">
                            <Tag color={elementInfo.cancelActivity ? 'red' : 'blue'}>
                              {elementInfo.cancelActivity ? 'Interrupting' : 'Non-interrupting'}
                            </Tag>
                          </Descriptions.Item>
                          {elementInfo.attachedToRef && (
                            <Descriptions.Item label="Attached To">
                              <Text code style={{ fontSize: '11px' }}>{elementInfo.attachedToRef}</Text>
                            </Descriptions.Item>
                          )}
                        </>
                      )}
                      {timerToken && (
                        <Descriptions.Item label="Has Token">
                          <Tag color="green">Yes - Token {timerToken.id.substring(0, 12)}...</Tag>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                )
              }
            })}
          />
        </Card>
        )
      })()}

      {/* Active Jobs Info */}
      {showDetails && jobs.length > 0 && (
        <Card 
          size="small" 
          style={{ marginBottom: '8px' }}
          styles={{ body: { padding: '8px 12px' } }}
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#722ed1' }} />
              <Text strong style={{ fontSize: '14px' }}>Jobs ({jobs.length})</Text>
            </Space>
          }
        >
          <Collapse 
            size="small"
            defaultActiveKey={[]}
            items={jobs.map((job: any, idx: number) => {
              const elementInfo = bpmnElements.get(job.element_id)
              const jobToken = activeTokens.find((t: any) => t.element_id === job.element_id)
              
              return {
                key: job.key,
                label: (
                  <Space size="small">
                    <Badge 
                      count={idx + 1} 
                      style={{ backgroundColor: '#722ed1' }}
                    />
                    <ThunderboltOutlined style={{ color: '#722ed1' }} />
                    <Text strong style={{ fontSize: '12px' }}>{job.type}</Text>
                    <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>
                      {elementInfo?.name || job.element_id}
                    </Tag>
                    <Tag 
                      color={job.state === 'ACTIVATABLE' ? 'processing' : job.state === 'COMPLETED' ? 'success' : 'default'}
                      style={{ fontSize: '10px', margin: 0 }}
                    >
                      {job.state}
                    </Tag>
                    <Badge count={job.retries} style={{ backgroundColor: job.retries > 0 ? '#52c41a' : '#d9d9d9' }} />
                  </Space>
                ),
                children: (
                  <div style={{ fontSize: '12px' }}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Job Key">
                        <Text code style={{ fontSize: '11px' }}>{job.key}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Job Type">
                        <Tag color="purple">{job.type}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Element ID">
                        <Text code style={{ fontSize: '11px' }}>{job.element_id}</Text>
                      </Descriptions.Item>
                      {elementInfo?.name && (
                        <Descriptions.Item label="Element Name">
                          {elementInfo.name}
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="State">
                        <Tag color={job.state === 'ACTIVATABLE' ? 'processing' : job.state === 'COMPLETED' ? 'success' : 'default'}>
                          {job.state}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Retries">
                        <Badge 
                          count={job.retries} 
                          showZero 
                          style={{ backgroundColor: job.retries > 0 ? '#52c41a' : '#d9d9d9' }}
                        />
                      </Descriptions.Item>
                      <Descriptions.Item label="Process Instance">
                        <Text code style={{ fontSize: '11px' }}>{job.process_instance_id}</Text>
                      </Descriptions.Item>
                      {job.worker && (
                        <Descriptions.Item label="Worker">
                          <Text code>{job.worker}</Text>
                        </Descriptions.Item>
                      )}
                      {job.deadline && (
                        <Descriptions.Item label="Deadline">
                          {dayjs(job.deadline * 1000).format('YYYY-MM-DD HH:mm:ss')}
                          <Text type="secondary" style={{ marginLeft: '8px', fontSize: '11px' }}>
                            ({dayjs(job.deadline * 1000).fromNow()})
                          </Text>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Created">
                        {dayjs(job.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '11px' }}>
                          ({dayjs(job.created_at * 1000).fromNow()})
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Updated">
                        {dayjs(job.updated_at * 1000).format('YYYY-MM-DD HH:mm:ss')}
                      </Descriptions.Item>
                      {jobToken && (
                        <Descriptions.Item label="Has Token">
                          <Tag color="green">Yes - Token {jobToken.id.substring(0, 12)}...</Tag>
                        </Descriptions.Item>
                      )}
                    </Descriptions>

                    {/* Custom Headers */}
                    {job.custom_headers && Object.keys(job.custom_headers).length > 0 && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={<Text strong style={{ fontSize: '12px' }}>Custom Headers</Text>}
                      >
                        <Descriptions column={1} size="small">
                          {Object.entries(job.custom_headers).map(([key, value]) => (
                            <Descriptions.Item key={key} label={key}>
                              <Text code>{String(value)}</Text>
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    )}

                    {/* Variables */}
                    {job.variables && Object.keys(job.variables).length > 0 && (
                      <Card 
                        size="small" 
                        style={{ marginTop: '8px' }}
                        title={<Text strong style={{ fontSize: '12px' }}>Variables</Text>}
                      >
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '11px',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(job.variables, null, 2)}
                        </pre>
                      </Card>
                    )}
                  </div>
                )
              }
            })}
          />
        </Card>
      )}

      {/* BPMN Viewer */}
      <Card 
        style={{ 
          minHeight: showDetails ? '600px' : 'calc(100vh - 200px)',
          height: showDetails ? '600px' : 'calc(100vh - 200px)',
          overflow: 'hidden'
        }}
        styles={{ body: { height: '100%', padding: 0 } }}
      >
        {xmlContent && (
          <BpmnViewerComponent 
            xml={xmlContent} 
            height="100%"
            activeTokens={showHistory ? tokenTrace : activeTokens}
            timers={timers}
            jobs={jobs}
          />
        )}
      </Card>
    </div>
  )
}

export default ProcessDiagramPage
