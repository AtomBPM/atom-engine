import { useEffect, useRef, useState } from 'react'
import { Button, Space, Typography, Modal, Descriptions, Tag, Divider, Card, Badge } from 'antd'
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, AimOutlined, CloseOutlined, BranchesOutlined } from '@ant-design/icons'
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'

const { Text, Title } = Typography

interface BpmnViewerProps {
  xml: string
  height?: string
  activeTokens?: any[]
  timers?: any[]
  jobs?: any[]
}

const BpmnViewerComponent = ({ xml, height = '600px', activeTokens = [], timers = [], jobs = [] }: BpmnViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<BpmnViewer | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedElement, setSelectedElement] = useState<any>(null)
  const [elementModalVisible, setElementModalVisible] = useState(false)
  const [conditionsModalVisible, setConditionsModalVisible] = useState(false)
  const [allConditions, setAllConditions] = useState<any[]>([])

  useEffect(() => {
    if (!containerRef.current || !xml) return

    const container = containerRef.current
    let isActive = true
    let wheelHandler: ((e: WheelEvent) => void) | null = null

    const viewer = new BpmnViewer({
      container: container
    })

    viewerRef.current = viewer

    viewer.importXML(xml).then(({ warnings }) => {
      if (!isActive) return

      if (warnings.length) {
        console.warn('BPMN warnings:', warnings)
      }

      const canvas = viewer.get('canvas')
      const eventBus = viewer.get('eventBus')
      
      canvas.zoom('fit-viewport')
      
      const currentZoom = canvas.zoom()
      setZoomLevel(Math.round(currentZoom * 100))

      eventBus.on('canvas.viewbox.changed', () => {
        const zoom = canvas.zoom()
        setZoomLevel(Math.round(zoom * 100))
      })

      // Collect all conditions from the diagram
      const elementRegistry = viewer.get('elementRegistry')
      const conditions: any[] = []
      
      elementRegistry.forEach((element: any) => {
        const bo = element.businessObject
        
        // Check for condition expression
        if (bo?.conditionExpression) {
          conditions.push({
            id: element.id,
            name: bo.name || element.id,
            type: element.type,
            expression: bo.conditionExpression.body,
            sourceRef: bo.sourceRef?.id,
            targetRef: bo.targetRef?.id
          })
        }
        
        // Check for gateway with outgoing flows
        if (element.type?.includes('Gateway') && bo?.outgoing?.length > 0) {
          bo.outgoing.forEach((flow: any) => {
            if (flow.conditionExpression) {
              conditions.push({
                id: flow.id,
                name: flow.name || flow.id,
                type: 'sequenceFlow',
                expression: flow.conditionExpression.body,
                sourceRef: flow.sourceRef?.id,
                targetRef: flow.targetRef?.id,
                gateway: element.id,
                gatewayName: bo.name
              })
            }
          })
        }
      })
      
      setAllConditions(conditions)

      // Handle element click
      eventBus.on('element.click', (event: any) => {
        const { element } = event
        if (element && element.type !== 'bpmn:Process' && element.type !== 'label') {
          const elementRegistry = viewer.get('elementRegistry')
          const fullElement = elementRegistry.get(element.id)
          
          const elementData = {
            id: fullElement.id,
            type: fullElement.type,
            name: fullElement.businessObject?.name || 'No name',
            businessObject: fullElement.businessObject,
            ...fullElement
          }
          
          setSelectedElement(elementData)
          setElementModalVisible(true)
        }
      })

      // Prevent scroll, only allow zoom
      wheelHandler = (e: WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        const currentZoom = canvas.zoom()
        canvas.zoom(currentZoom + delta)
      }

      container.addEventListener('wheel', wheelHandler, { passive: false })
    }).catch((err) => {
      if (isActive) {
        console.error('Error rendering BPMN diagram:', err)
      }
    })

    return () => {
      isActive = false
      if (wheelHandler) {
        container.removeEventListener('wheel', wheelHandler)
      }
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy()
        } catch (err) {
          console.error('Error destroying viewer:', err)
        }
        viewerRef.current = null
      }
    }
  }, [xml])

  useEffect(() => {
    if (!viewerRef.current) return

    try {
      const canvas = viewerRef.current.get('canvas')
      const overlays = viewerRef.current.get('overlays')
      const elementRegistry = viewerRef.current.get('elementRegistry')

      // Remove previous overlays
      overlays.clear()

      // Separate main and boundary tokens
      const mainTokens: any[] = []
      const boundaryTokens: any[] = []
      
      activeTokens.forEach((token: any) => {
        const element = elementRegistry.get(token.element_id)
        if (element?.businessObject?.attachedToRef) {
          boundaryTokens.push(token)
        } else {
          mainTokens.push(token)
        }
      })

      // Add overlays for main tokens
      mainTokens.forEach((token: any, index: number) => {
        
        const element = elementRegistry.get(token.element_id)
        
        if (element) {
          // Color based on token state
          let color = '#d9d9d9' // default gray
          let bgColor = 'rgba(217, 217, 217, 0.3)'
          
          switch (token.state) {
            case 'ACTIVE':
              color = '#52c41a' // green
              bgColor = 'rgba(82, 196, 26, 0.3)'
              break
            case 'COMPLETED':
              color = '#1890ff' // blue
              bgColor = 'rgba(24, 144, 255, 0.2)'
              break
            case 'CANCELLED':
              color = '#ff4d4f' // red
              bgColor = 'rgba(255, 77, 79, 0.2)'
              break
            case 'TERMINATED':
              color = '#8c8c8c' // gray
              bgColor = 'rgba(140, 140, 140, 0.2)'
              break
            default:
              color = '#faad14' // orange
              bgColor = 'rgba(250, 173, 20, 0.3)'
          }
          
          // Add highlight overlay
          const overlayHtml = document.createElement('div')
          const animation = token.state === 'ACTIVE' ? 'pulse 2s infinite' : 'none'
          overlayHtml.style.cssText = `
            background: ${bgColor};
            border: 3px solid ${color};
            border-radius: 8px;
            width: 100%;
            height: 100%;
            pointer-events: none;
            animation: ${animation};
          `
          
          overlays.add(token.element_id, {
            position: {
              top: -3,
              left: -3
            },
            html: overlayHtml
          })

          // Add token badge
          const badgeHtml = document.createElement('div')
          badgeHtml.style.cssText = `
            background: ${color};
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          `
          badgeHtml.textContent = (index + 1).toString()
          badgeHtml.title = `Token ${index + 1}\nID: ${token.id}\nState: ${token.state}\nElement: ${token.element_id}`
          
          overlays.add(token.element_id, {
            position: {
              top: -12,
              right: -12
            },
            html: badgeHtml
          })
        }
      })

      // Add overlays for boundary tokens
      boundaryTokens.forEach((token: any, index: number) => {
        
        const element = elementRegistry.get(token.element_id)
        
        if (element) {
          // Color for boundary tokens - use orange/purple palette
          let color = '#fa8c16' // orange for active boundary
          let bgColor = 'rgba(250, 140, 22, 0.3)'
          
          switch (token.state) {
            case 'ACTIVE':
              color = '#fa8c16' // orange
              bgColor = 'rgba(250, 140, 22, 0.4)'
              break
            case 'COMPLETED':
              color = '#722ed1' // purple
              bgColor = 'rgba(114, 46, 209, 0.2)'
              break
            case 'CANCELLED':
              color = '#ff4d4f' // red
              bgColor = 'rgba(255, 77, 79, 0.2)'
              break
            default:
              color = '#d9d9d9' // gray
              bgColor = 'rgba(217, 217, 217, 0.2)'
          }
          
          // Add highlight overlay with dashed border for boundary
          const overlayHtml = document.createElement('div')
          const animation = token.state === 'ACTIVE' ? 'pulse 2s infinite' : 'none'
          overlayHtml.style.cssText = `
            background: ${bgColor};
            border: 3px dashed ${color};
            border-radius: 50%;
            width: 100%;
            height: 100%;
            pointer-events: none;
            animation: ${animation};
          `
          
          overlays.add(token.element_id, {
            position: {
              top: -3,
              left: -3
            },
            html: overlayHtml
          })

          // Add token badge with "B" prefix for boundary
          const badgeHtml = document.createElement('div')
          badgeHtml.style.cssText = `
            background: ${color};
            color: white;
            border-radius: 4px;
            min-width: 28px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            padding: 0 4px;
          `
          badgeHtml.textContent = `B${index + 1}`
          badgeHtml.title = `Boundary Token ${index + 1}\nID: ${token.id}\nState: ${token.state}\nElement: ${token.element_id}`
          
          overlays.add(token.element_id, {
            position: {
              top: -12,
              right: -12
            },
            html: badgeHtml
          })
          
          // Try to highlight the parent element too (if it exists)
          const parentRef = element.businessObject?.attachedToRef
          if (parentRef) {
            const parentElement = elementRegistry.get(parentRef)
            if (parentElement) {
              // Add subtle highlight to parent element
              const parentOverlayHtml = document.createElement('div')
              parentOverlayHtml.style.cssText = `
                border: 2px dotted ${color};
                border-radius: 4px;
                width: 100%;
                height: 100%;
                pointer-events: none;
                opacity: 0.3;
              `
              
              overlays.add(parentRef, {
                position: {
                  top: -2,
                  left: -2
                },
                html: parentOverlayHtml
              })
              
            }
          }
        }
      })

      // Add pulse animation to head if not exists
      if (!document.getElementById('bpmn-token-pulse')) {
        const style = document.createElement('style')
        style.id = 'bpmn-token-pulse'
        style.textContent = `
          @keyframes pulse {
            0%, 100% {
              opacity: 0.3;
            }
            50% {
              opacity: 0.6;
            }
          }
        `
        document.head.appendChild(style)
      }
      
      // Add timer overlays
      timers.forEach((timer: any) => {
        const element = elementRegistry.get(timer.element_id)
        if (!element) return
        
        // Format remaining time
        const formatTime = (seconds: number) => {
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
        
        const remainingTime = timer.remaining_seconds !== undefined 
          ? formatTime(timer.remaining_seconds)
          : 'N/A'
        
        const elementsWithTokens = new Set(activeTokens.map(t => t.element_id))
        const hasToken = elementsWithTokens.has(timer.element_id)
        
        // Determine color based on remaining time
        let bgGradient = 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
        if (timer.remaining_seconds !== undefined) {
          if (timer.remaining_seconds < 30) {
            bgGradient = 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)'
          } else if (timer.remaining_seconds < 60) {
            bgGradient = 'linear-gradient(135deg, #faad14 0%, #d48806 100%)'
          }
        }
        
        const timerIconHtml = document.createElement('div')
        timerIconHtml.style.cssText = `
          background: ${bgGradient};
          color: white;
          border-radius: 16px;
          min-width: 50px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
          animation: timer-pulse 2s infinite;
          border: 2px solid white;
          padding: 0 8px;
          white-space: nowrap;
        `
        timerIconHtml.textContent = remainingTime
        timerIconHtml.title = `Timer: ${timer.timer_type}\nStatus: ${timer.status}\nRemaining: ${remainingTime}\nElement: ${timer.element_id}`
        
        const position = hasToken ? {
          top: 0,
          left: -60
        } : {
          top: -18,
          left: -25
        }
        
        overlays.add(timer.element_id, {
          position,
          html: timerIconHtml
        })
      })
      
      // Add timer pulse animation
      if (!document.getElementById('bpmn-timer-pulse')) {
        const style = document.createElement('style')
        style.id = 'bpmn-timer-pulse'
        style.textContent = `
          @keyframes timer-pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 4px 12px rgba(24, 144, 255, 0.7);
            }
          }
        `
        document.head.appendChild(style)
      }
      
      // Add job overlays
      const allElements = elementRegistry.getAll()
      const elementsWithTokens = new Set(activeTokens.map(t => t.element_id))
      
      // Find service tasks with active tokens
      const tokenJobMap = new Map()
      activeTokens.forEach((token: any) => {
        const element = elementRegistry.get(token.element_id)
        if (element && element.type === 'bpmn:ServiceTask') {
          tokenJobMap.set(token.element_id, token)
        }
      })
      
      jobs.forEach((job: any) => {
        // Try to find element by token location
        let element = null
        let elementId = ''
        
        for (const [tokenElementId, token] of tokenJobMap) {
          element = elementRegistry.get(tokenElementId)
          if (element) {
            elementId = tokenElementId
            break
          }
        }
        
        if (!element) return
        
        const hasToken = true // We already know there's a token since we found it via tokenJobMap
        
        let bgGradient = 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)'
        if (job.state === 'FAILED') {
          bgGradient = 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)'
        } else if (job.state === 'COMPLETED') {
          bgGradient = 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
        }
        
        const jobHtml = document.createElement('div')
        jobHtml.style.cssText = `
          background: ${bgGradient};
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          cursor: pointer;
          border: 2px solid white;
          z-index: 1000;
          position: relative;
        `
        jobHtml.textContent = `⚡`
        jobHtml.title = `Job: ${job.type}\nState: ${job.state}\nRetries: ${job.retries}`
        
        // Position above element
        overlays.add(elementId, {
          position: { top: -22, left: 5 },
          html: jobHtml
        })
      })
      
    } catch (err) {
      console.error('Error adding overlays:', err)
    }
  }, [activeTokens, timers, jobs])

  const handleZoomIn = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas')
      canvas.zoom(canvas.zoom() + 0.1)
    }
  }

  const handleZoomOut = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas')
      canvas.zoom(canvas.zoom() - 0.1)
    }
  }

  const handleZoomFit = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas')
      canvas.zoom('fit-viewport')
    }
  }

  const handleZoomReset = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas')
      canvas.zoom(1)
      canvas.viewbox({ x: 0, y: 0, width: 1000, height: 1000 })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Zoom Controls */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '4px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: '10px', textAlign: 'center', display: 'block' }}>
            {zoomLevel}%
          </Text>
          <Space.Compact direction="vertical">
            <Button 
              size="small"
              type="text"
              icon={<ZoomInOutlined style={{ fontSize: '12px' }} />} 
              onClick={handleZoomIn}
              title="Zoom In"
              style={{ padding: '2px 4px', height: '24px' }}
            />
            <Button 
              size="small"
              type="text"
              icon={<ZoomOutOutlined style={{ fontSize: '12px' }} />} 
              onClick={handleZoomOut}
              title="Zoom Out"
              style={{ padding: '2px 4px', height: '24px' }}
            />
            <Button 
              size="small"
              type="text"
              icon={<FullscreenOutlined style={{ fontSize: '12px' }} />} 
              onClick={handleZoomFit}
              title="Fit"
              style={{ padding: '2px 4px', height: '24px' }}
            />
            <Button 
              size="small"
              type="text"
              icon={<AimOutlined style={{ fontSize: '12px' }} />} 
              onClick={handleZoomReset}
              title="Reset"
              style={{ padding: '2px 4px', height: '24px' }}
            />
          </Space.Compact>
        </Space>
      </div>

      {/* Conditions Button */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        zIndex: 10
      }}>
        <Button 
          type="primary"
          size="small"
          icon={<BranchesOutlined />} 
          onClick={() => {
            console.log('Conditions button clicked')
            setConditionsModalVisible(true)
          }}
          title="View All Conditions"
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            fontSize: '12px',
            padding: '4px 8px'
          }}
        >
          {allConditions.length > 0 && (
            <Badge 
              count={allConditions.length} 
              style={{ marginLeft: '4px' }}
            />
          )}
        </Button>
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.75)',
        padding: '4px 8px',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '10px',
        lineHeight: '1.4'
      }}>
        <div>🖱️ Scroll to zoom</div>
        <div>✋ Drag to pan</div>
      </div>

      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          background: '#ffffff'
        }} 
      />

      {/* Element Details Modal */}
      <Modal
        title={
          <Space>
            <Tag color="blue">{selectedElement?.type?.replace('bpmn:', '')}</Tag>
            <Text strong>{selectedElement?.name}</Text>
          </Space>
        }
        open={elementModalVisible}
        onCancel={() => {
          setElementModalVisible(false)
          setSelectedElement(null)
        }}
        width={800}
        footer={null}
      >
        {selectedElement && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Info */}
            <Card size="small" title="Basic Information">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Element ID">
                  <Text code>{selectedElement.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color="blue">{selectedElement.type}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Name">
                  {selectedElement.businessObject?.name || <Text type="secondary">No name</Text>}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Documentation */}
            {selectedElement.businessObject?.documentation?.[0]?.text && (
              <Card size="small" title="Documentation">
                <Text>{selectedElement.businessObject.documentation[0].text}</Text>
              </Card>
            )}

            {/* Variables & Expressions */}
            {(selectedElement.businessObject?.conditionExpression || 
              selectedElement.businessObject?.timeDuration ||
              selectedElement.businessObject?.timeCycle) && (
              <Card size="small" title="Configuration">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selectedElement.businessObject?.conditionExpression && (
                    <div>
                      <Text strong style={{ color: '#1890ff' }}>Condition Expression:</Text>
                      <pre style={{ 
                        background: '#1f1f1f', 
                        padding: '8px', 
                        borderRadius: '4px',
                        border: '1px solid #333',
                        marginTop: '4px'
                      }}>
                        <code style={{ color: '#52c41a' }}>{selectedElement.businessObject.conditionExpression.body}</code>
                      </pre>
                    </div>
                  )}
                  
                  {selectedElement.businessObject?.timeDuration && (
                    <div>
                      <Text strong style={{ color: '#1890ff' }}>Timer Duration:</Text>
                      <Text code style={{ marginLeft: '8px' }}>
                        {selectedElement.businessObject.timeDuration.body}
                      </Text>
                    </div>
                  )}

                  {selectedElement.businessObject?.timeCycle && (
                    <div>
                      <Text strong style={{ color: '#1890ff' }}>Timer Cycle:</Text>
                      <Text code style={{ marginLeft: '8px' }}>
                        {selectedElement.businessObject.timeCycle.body}
                      </Text>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {/* Extension Elements (Zeebe/Camunda) */}
            {selectedElement.businessObject?.extensionElements?.values?.length > 0 && (
              <Card size="small" title="Extension Elements">
                {selectedElement.businessObject.extensionElements.values.map((ext: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#722ed1' }}>
                      {ext.$type?.replace('zeebe:', '').replace('camunda:', '')}:
                    </Text>
                    
                    {/* Task Definition */}
                    {ext.$type?.includes('taskDefinition') && (
                      <div style={{ marginTop: '4px' }}>
                        <Text>Type: <Text code>{ext.type}</Text></Text>
                        {ext.retries && <Text style={{ marginLeft: '12px' }}>Retries: <Text code>{ext.retries}</Text></Text>}
                      </div>
                    )}

                    {/* IO Mapping */}
                    {ext.$type?.includes('ioMapping') && (
                      <div style={{ marginTop: '4px' }}>
                        {ext.inputParameters?.length > 0 && (
                          <div>
                            <Text strong>Input Parameters:</Text>
                            {ext.inputParameters.map((param: any, i: number) => (
                              <div key={i} style={{ marginLeft: '16px' }}>
                                <Text code>{param.target}</Text> = <Text code>{param.source}</Text>
                              </div>
                            ))}
                          </div>
                        )}
                        {ext.outputParameters?.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <Text strong>Output Parameters:</Text>
                            {ext.outputParameters.map((param: any, i: number) => (
                              <div key={i} style={{ marginLeft: '16px' }}>
                                <Text code>{param.target}</Text> = <Text code>{param.source}</Text>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Task Headers */}
                    {ext.$type?.includes('taskHeaders') && ext.values?.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        {ext.values.map((header: any, i: number) => (
                          <div key={i} style={{ marginLeft: '16px' }}>
                            <Text code>{header.key}</Text> = <Text code>{header.value}</Text>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Called Element */}
                    {ext.$type?.includes('calledElement') && (
                      <div style={{ marginTop: '4px' }}>
                        <Text>Process ID: <Text code>{ext.processId}</Text></Text>
                        {ext.propagateAllChildVariables !== undefined && (
                          <Text style={{ marginLeft: '12px' }}>
                            Propagate Variables: <Tag color={ext.propagateAllChildVariables ? 'green' : 'red'}>
                              {ext.propagateAllChildVariables ? 'Yes' : 'No'}
                            </Tag>
                          </Text>
                        )}
                      </div>
                    )}

                    {/* Subscription */}
                    {ext.$type?.includes('subscription') && (
                      <div style={{ marginTop: '4px' }}>
                        {ext.correlationKey && (
                          <Text>Correlation Key: <Text code>{ext.correlationKey}</Text></Text>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {/* Event Definitions */}
            {selectedElement.businessObject?.eventDefinitions?.length > 0 && (
              <Card size="small" title="Event Definitions">
                {selectedElement.businessObject.eventDefinitions.map((eventDef: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <Tag color="orange">{eventDef.$type?.replace('bpmn:', '')}</Tag>
                    {eventDef.messageRef && (
                      <Text style={{ marginLeft: '8px' }}>
                        Message: <Text code>{eventDef.messageRef.name || eventDef.messageRef.id}</Text>
                      </Text>
                    )}
                    {eventDef.errorRef && (
                      <Text style={{ marginLeft: '8px' }}>
                        Error: <Text code>{eventDef.errorRef.name || eventDef.errorRef.errorCode}</Text>
                      </Text>
                    )}
                    {eventDef.signalRef && (
                      <Text style={{ marginLeft: '8px' }}>
                        Signal: <Text code>{eventDef.signalRef.name}</Text>
                      </Text>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {/* Incoming/Outgoing Flows */}
            {(selectedElement.businessObject?.incoming?.length > 0 || 
              selectedElement.businessObject?.outgoing?.length > 0) && (
              <Card size="small" title="Connections">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selectedElement.businessObject?.incoming?.length > 0 && (
                    <div>
                      <Text strong style={{ color: '#52c41a' }}>Incoming:</Text>
                      {selectedElement.businessObject.incoming.map((flow: any) => (
                        <div key={flow.id} style={{ marginLeft: '16px' }}>
                          <Text code>{flow.id}</Text>
                          {flow.name && <Text> - {flow.name}</Text>}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedElement.businessObject?.outgoing?.length > 0 && (
                    <div>
                      <Text strong style={{ color: '#ff4d4f' }}>Outgoing:</Text>
                      {selectedElement.businessObject.outgoing.map((flow: any) => (
                        <div key={flow.id} style={{ marginLeft: '16px' }}>
                          <Text code>{flow.id}</Text>
                          {flow.name && <Text> - {flow.name}</Text>}
                        </div>
                      ))}
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {/* Raw Data */}
            <Card 
              size="small" 
              title="Raw Element Data"
              extra={
                <Button 
                  size="small" 
                  type="text"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedElement.businessObject, null, 2))
                  }}
                >
                  Copy JSON
                </Button>
              }
            >
              <pre style={{ 
                background: '#1f1f1f', 
                padding: '12px', 
                borderRadius: '4px',
                border: '1px solid #333',
                maxHeight: '300px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                <code style={{ color: '#e6e6e6' }}>{JSON.stringify(selectedElement.businessObject, null, 2)}</code>
              </pre>
            </Card>
          </Space>
        )}
      </Modal>

      {/* All Conditions Modal */}
      <Modal
        title={
          <Space>
            <BranchesOutlined style={{ color: '#1890ff' }} />
            <Text strong>All Condition Expressions ({allConditions.length})</Text>
          </Space>
        }
        open={conditionsModalVisible}
        onCancel={() => setConditionsModalVisible(false)}
        width={900}
        footer={null}
        styles={{ body: { background: '#141414', maxHeight: '70vh', overflow: 'auto' } }}
      >
        {allConditions.length > 0 ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {allConditions.map((condition, idx) => (
              <Card
                key={condition.id}
                size="small"
                style={{ background: '#1f1f1f', border: '1px solid #333' }}
                title={
                  <Space>
                    <Tag color="purple">#{idx + 1}</Tag>
                    <Text strong style={{ color: '#e6e6e6' }}>{condition.name}</Text>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text style={{ color: '#91d5ff' }}>Element ID: </Text>
                    <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #434343' }}>
                      {condition.id}
                    </Text>
                  </div>

                  {condition.gateway && (
                    <div>
                      <Text style={{ color: '#91d5ff' }}>Gateway: </Text>
                      <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #434343' }}>
                        {condition.gateway}
                      </Text>
                      {condition.gatewayName && <Text style={{ color: '#e6e6e6' }}> ({condition.gatewayName})</Text>}
                    </div>
                  )}

                  {condition.sourceRef && condition.targetRef && (
                    <div>
                      <Text style={{ color: '#91d5ff' }}>Flow: </Text>
                      <Space size="small">
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #434343' }}>
                          {condition.sourceRef}
                        </Text>
                        <Text style={{ color: '#e6e6e6' }}>→</Text>
                        <Text code style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #434343' }}>
                          {condition.targetRef}
                        </Text>
                      </Space>
                    </div>
                  )}

                  <Divider style={{ margin: '8px 0', borderColor: '#434343' }} />

                  <div>
                    <Text strong style={{ color: '#91d5ff' }}>Expression:</Text>
                    <pre style={{ 
                      background: '#0d0d0d', 
                      padding: '12px', 
                      borderRadius: '4px',
                      border: '1px solid #333',
                      marginTop: '8px',
                      fontSize: '13px'
                    }}>
                      <code style={{ color: '#52c41a' }}>{condition.expression}</code>
                    </pre>
                  </div>

                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      if (viewerRef.current) {
                        const canvas = viewerRef.current.get('canvas')
                        const elementRegistry = viewerRef.current.get('elementRegistry')
                        
                        // Try to find element in order
                        const element = elementRegistry.get(condition.id) || 
                                       elementRegistry.get(condition.sourceRef) ||
                                       elementRegistry.get(condition.gateway)
                        
                        if (element) {
                          // Close modal first
                          setConditionsModalVisible(false)
                          
                          // Navigate to element after modal closes
                          setTimeout(() => {
                            // Scroll to element
                            canvas.scrollToElement(element, { top: 100, left: 100, right: 100, bottom: 100 })
                            
                            setTimeout(() => {
                              canvas.zoom(1.2)
                              
                              // Highlight element using SVG
                              setTimeout(() => {
                                const gfx = elementRegistry.getGraphics(element)
                                if (gfx) {
                                  const svgElement = gfx.querySelector('[data-element-id="' + element.id + '"]') || 
                                                    gfx.querySelector('path') || 
                                                    gfx.querySelector('rect') ||
                                                    gfx.querySelector('circle')
                                  
                                  if (svgElement) {
                                    const originalStroke = svgElement.style.stroke || svgElement.getAttribute('stroke')
                                    const originalStrokeWidth = svgElement.style.strokeWidth || svgElement.getAttribute('stroke-width')
                                    const originalFill = svgElement.style.fill || svgElement.getAttribute('fill')
                                    
                                    // Flash animation
                                    let count = 0
                                    const flashInterval = setInterval(() => {
                                      if (count % 2 === 0) {
                                        svgElement.style.stroke = '#ff0000'
                                        svgElement.style.strokeWidth = '6px'
                                        if (element.type !== 'bpmn:SequenceFlow') {
                                          svgElement.style.fill = '#ffcccc'
                                        }
                                      } else {
                                        svgElement.style.stroke = originalStroke
                                        svgElement.style.strokeWidth = originalStrokeWidth
                                        if (element.type !== 'bpmn:SequenceFlow') {
                                          svgElement.style.fill = originalFill
                                        }
                                      }
                                      count++
                                      if (count >= 6) {
                                        clearInterval(flashInterval)
                                        svgElement.style.stroke = originalStroke
                                        svgElement.style.strokeWidth = originalStrokeWidth
                                        if (element.type !== 'bpmn:SequenceFlow') {
                                          svgElement.style.fill = originalFill
                                        }
                                      }
                                    }, 500)
                                  }
                                }
                              }, 300)
                            }, 200)
                          }, 300)
                        } else {
                          console.warn('Element not found:', condition)
                        }
                      }
                    }}
                  >
                    Show on Diagram →
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Text style={{ color: '#e6e6e6' }}>No condition expressions found in this process</Text>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default BpmnViewerComponent
