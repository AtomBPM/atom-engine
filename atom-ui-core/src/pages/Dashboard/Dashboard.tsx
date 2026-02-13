import { Card, Row, Col, Statistic, Typography, Space, Spin, Tag } from 'antd'
import {
  CloudServerOutlined,
  DatabaseOutlined,
  BranchesOutlined,
  CodeOutlined,
  MessageOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useApi } from '../../hooks/useApi'
import * as systemApi from '../../api/endpoints/system'
import * as storageApi from '../../api/endpoints/storage'
import * as processesApi from '../../api/endpoints/processes'
import * as jobsApi from '../../api/endpoints/jobs'
import * as timersApi from '../../api/endpoints/timers'
import * as messagesApi from '../../api/endpoints/messages'
import * as incidentsApi from '../../api/endpoints/incidents'
import * as bpmnApi from '../../api/endpoints/bpmn'

const { Title } = Typography

const Dashboard = () => {
  const { data: systemStatus, loading: systemLoading } = useApi(systemApi.getSystemStatus, { immediate: true })
  const { data: storageStatus, loading: storageLoading } = useApi(storageApi.getStorageStatus, { immediate: true })
  const { data: processStats } = useApi(processesApi.getProcessStats, { immediate: true })
  const { data: jobStats } = useApi(jobsApi.getJobStats, { immediate: true })
  const { data: timerStats } = useApi(timersApi.getTimerStats, { immediate: true })
  const { data: messageStats } = useApi(messagesApi.getMessageStats, { immediate: true })
  const { data: incidentStats } = useApi(incidentsApi.getIncidentStats, { immediate: true })
  const { data: bpmnStats } = useApi(bpmnApi.getBPMNStats, { immediate: true })

  const loading = systemLoading || storageLoading

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    )
  }

  // Helper functions for data processing
  const isStorageConnected = storageStatus?.status?.toLowerCase() === 'ready'
  const systemStatusLower = systemStatus?.status?.toLowerCase() || 'unknown'
  const systemHealthLower = systemStatus?.health?.toLowerCase() || 'unknown'
  const uptimeSeconds = systemStatus?.uptime ? Math.floor(systemStatus.uptime / 1e9) : 0

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Dashboard</Title>
          <Typography.Text type="secondary">
            Overview of ATOM Engine system
          </Typography.Text>
        </div>

        {/* System Health */}
        <Card title="System Health" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="System Status"
                  value={systemStatusLower.charAt(0).toUpperCase() + systemStatusLower.slice(1)}
                  valueStyle={{ 
                    color: systemStatusLower === 'running' ? '#3f8600' : '#cf1322',
                    fontSize: '20px'
                  }}
                  prefix={<CloudServerOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Storage"
                  value={isStorageConnected ? 'Connected' : 'Disconnected'}
                  valueStyle={{ 
                    color: isStorageConnected ? '#3f8600' : '#cf1322',
                    fontSize: '18px'
                  }}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Health"
                  value={systemHealthLower.charAt(0).toUpperCase() + systemHealthLower.slice(1)}
                  valueStyle={{ 
                    color: systemHealthLower === 'healthy' ? '#3f8600' : '#cf1322',
                    fontSize: '18px'
                  }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Uptime"
                  value={uptimeSeconds}
                  suffix="sec"
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* BPMN & Processes */}
        <Card title="BPMN & Processes" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="BPMN Processes"
                  value={bpmnStats?.total_processes || 0}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Total Process Instances"
                  value={processStats?.total_instances || 0}
                  prefix={<BranchesOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Active Processes"
                  value={processStats?.active_instances || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Completed"
                  value={processStats?.completed_instances || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Cancelled"
                  value={processStats?.cancelled_instances || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Avg Execution Time"
                  value={processStats?.average_execution_time_ms || 0}
                  suffix="ms"
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Jobs & Timers */}
        <Card title="Jobs & Timers" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Jobs"
                  value={jobStats?.total_jobs || 0}
                  prefix={<CodeOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Active Jobs"
                  value={jobStats?.active_jobs || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Timers"
                  value={timerStats?.total_timers || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Pending Timers"
                  value={timerStats?.pending_timers || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Messages & Incidents */}
        <Card title="Messages & Incidents" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Total Messages"
                  value={messageStats?.total_messages || 0}
                  prefix={<MessageOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Buffered Messages"
                  value={messageStats?.buffered_messages || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Subscriptions"
                  value={messageStats?.subscriptions_count || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Total Incidents"
                  value={incidentStats?.total_incidents || 0}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Open Incidents"
                  value={incidentStats?.open_incidents || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Resolved Incidents"
                  value={incidentStats?.resolved_incidents || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Quick Info */}
        <Card title="System Information">
          <Space direction="vertical" size="small">
            <div>
              <Typography.Text type="secondary">Version: </Typography.Text>
              <Tag color="blue">{systemStatus?.version || 'Unknown'}</Tag>
            </div>
            <div>
              <Typography.Text type="secondary">Components: </Typography.Text>
              <Typography.Text strong>{systemStatus?.components_total || 0}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Storage Health: </Typography.Text>
              <Tag color={storageStatus?.is_healthy ? 'success' : 'error'}>
                {storageStatus?.is_healthy ? 'HEALTHY' : 'UNHEALTHY'}
              </Tag>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default Dashboard
