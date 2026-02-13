import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Typography, Tag, Spin, message } from 'antd'
import { ArrowLeftOutlined, FullscreenOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import * as bpmnApi from '../../api/endpoints/bpmn'
import BpmnViewerComponent from '../../components/BpmnViewer'

const { Title, Text } = Typography

const BpmnDiagramPage = () => {
  const { processKey } = useParams<{ processKey: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [xmlContent, setXmlContent] = useState<string>('')
  const [processInfo, setProcessInfo] = useState<any>(null)

  useEffect(() => {
    if (processKey) {
      loadDiagram()
    }
  }, [processKey])

  const loadDiagram = async () => {
    try {
      setLoading(true)
      const [xml, processes] = await Promise.all([
        bpmnApi.getBPMNProcessXML(processKey!),
        bpmnApi.listBPMNProcesses({ page: 1, limit: 100 })
      ])
      
      setXmlContent(xml)
      
      // Find process info
      const process = processes.data.find((p: any) => p.key === processKey)
      setProcessInfo(process)
    } catch (error) {
      message.error('Failed to load BPMN diagram')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/bpmn')
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 'calc(100vh - 200px)' 
      }}>
        <Spin size="large" tip="Loading BPMN diagram..." />
      </div>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Card 
        size="small" 
        style={{ marginBottom: '16px' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
            >
              Back to BPMN List
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {processInfo?.name || 'BPMN Diagram'}
            </Title>
          </Space>
          
          {processInfo && (
            <Space size="large">
              <Space>
                <Text strong>Process Key:</Text>
                <Text code>{processInfo.key}</Text>
              </Space>
              <Space>
                <Text strong>Process ID:</Text>
                <Text code>{processInfo.id}</Text>
              </Space>
              <Space>
                <Text strong>Version:</Text>
                <Tag color="blue">v{processInfo.version}</Tag>
              </Space>
              <Space>
                <Text strong>Status:</Text>
                <Tag color={processInfo.metadata?.status === 'active' ? 'green' : 'default'}>
                  {processInfo.metadata?.status || 'unknown'}
                </Tag>
              </Space>
              <Space>
                <Text strong>Elements:</Text>
                <Tag>{processInfo.element_count}</Tag>
              </Space>
            </Space>
          )}
        </Space>
      </Card>

      {/* BPMN Viewer */}
      <Card 
        style={{ flex: 1, overflow: 'hidden' }}
        bodyStyle={{ height: '100%', padding: 0 }}
      >
        {xmlContent && (
          <BpmnViewerComponent 
            xml={xmlContent} 
            height="100%" 
          />
        )}
      </Card>
    </div>
  )
}

export default BpmnDiagramPage
