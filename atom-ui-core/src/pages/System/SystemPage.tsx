import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Typography, Space, Table, Tag, Button, Spin } from 'antd'
import {
  CloudServerOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useApi } from '../../hooks/useApi'
import * as systemApi from '../../api/endpoints/system'
import * as storageApi from '../../api/endpoints/storage'
import * as daemonApi from '../../api/endpoints/daemon'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const SystemPage = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  
  const { data: status, loading: statusLoading } = useApi(
    systemApi.getSystemStatus,
    { immediate: true }
  )
  
  const { data: info, loading: infoLoading } = useApi(
    systemApi.getSystemInfo,
    { immediate: true }
  )
  
  const { data: metrics, loading: metricsLoading } = useApi(
    systemApi.getSystemMetrics,
    { immediate: true }
  )
  
  const { data: components, loading: componentsLoading } = useApi(
    systemApi.listComponents,
    { immediate: true }
  )
  
  const { data: storageInfo, loading: storageLoading } = useApi(
    storageApi.getStorageInfo,
    { immediate: true }
  )

  const { data: events, loading: eventsLoading, refetch: refetchEvents } = useApi(
    () => daemonApi.getDaemonEvents(50),
    { immediate: true }
  )

  useEffect(() => {
    // Trigger refresh when refreshKey changes
  }, [refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    window.location.reload()
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const loading = statusLoading || infoLoading || metricsLoading || componentsLoading || storageLoading

  const eventColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id: string) => <Text code>{id.substring(0, 12)}...</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default'
        if (status === 'success') color = 'success'
        else if (status === 'error' || status === 'failed') color = 'error'
        else if (status === 'warning') color = 'warning'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const componentColumns = [
    {
      title: 'Component',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'RUNNING' ? 'success' : 'error'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Health',
      dataIndex: 'health',
      key: 'health',
      render: (health: string) => (
        <Tag 
          icon={health === 'HEALTHY' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={health === 'HEALTHY' ? 'success' : 'error'}
        >
          {health}
        </Tag>
      ),
    },
    {
      title: 'Uptime',
      dataIndex: 'uptime',
      key: 'uptime',
      render: (uptime: number) => {
        const totalSeconds = Math.floor(uptime / 1000000000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      },
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>System Management</Title>
            <Text type="secondary">System status, metrics, and component monitoring</Text>
          </div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </div>

        {loading && !status ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* System Status */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="System Status"
                    value={status?.status || 'Unknown'}
                    valueStyle={{ 
                      color: status?.status === 'RUNNING' ? '#3f8600' : '#cf1322' 
                    }}
                    prefix={<CloudServerOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Health"
                    value={status?.health || 'Unknown'}
                    valueStyle={{ 
                      color: status?.health === 'HEALTHY' ? '#3f8600' : '#cf1322' 
                    }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Uptime"
                    value={status?.uptime ? (() => {
                      const totalSeconds = Math.floor(status.uptime / 1000000000)
                      const hours = Math.floor(totalSeconds / 3600)
                      const minutes = Math.floor((totalSeconds % 3600) / 60)
                      const seconds = totalSeconds % 60
                      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                    })() : '0:00:00'}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Components"
                    value={status?.components_total || 0}
                  />
                </Card>
              </Col>
            </Row>

            {/* System Info */}
            <Card title="System Information">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Space direction="vertical">
                    <div><Text type="secondary">Instance Name:</Text> <Text strong>{info?.configuration?.instance_name}</Text></div>
                    <div><Text type="secondary">Version:</Text> <Text strong>{info?.version}</Text></div>
                    <div><Text type="secondary">Build Time:</Text> <Text>{info?.build_time}</Text></div>
                    <div><Text type="secondary">Environment:</Text> <Text>{info?.environment}</Text></div>
                  </Space>
                </Col>
                <Col xs={24} md={12}>
                  <Space direction="vertical">
                    <div><Text type="secondary">Hostname:</Text> <Text>{info?.host_info?.hostname}</Text></div>
                    <div><Text type="secondary">OS:</Text> <Text>{info?.host_info?.os}</Text></div>
                    <div><Text type="secondary">Architecture:</Text> <Text>{info?.host_info?.architecture}</Text></div>
                    <div><Text type="secondary">CPU Cores:</Text> <Text>{info?.host_info?.cpu_cores}</Text></div>
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* System Metrics */}
            <Card title="System Metrics">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="CPU Usage"
                    value={metrics?.cpu_usage?.toFixed(2) || 0}
                    suffix="%"
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="Memory Usage"
                    value={metrics?.memory_usage ? (metrics.memory_usage / 1024 / 1024).toFixed(2) : 0}
                    suffix="MB"
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="Goroutines"
                    value={metrics?.goroutines || 0}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="Total Requests"
                    value={metrics?.total_requests || 0}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="Database Size"
                    value={formatBytes(storageInfo?.used_size_bytes || 0)}
                  />
                </Col>
              </Row>
            </Card>

            {/* Components Table */}
            <Card title="Components Status">
              <Table
                columns={componentColumns}
                dataSource={components || []}
                rowKey="name"
                pagination={false}
                loading={componentsLoading}
              />
            </Card>

            {/* System Events */}
            <Card 
              title="System Events" 
              extra={
                <Text type="secondary">
                  Showing {events?.events?.length || 0} of {events?.total_count || 0} events
                </Text>
              }
            >
              {!events?.events || events.events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No events found</Text>
                </div>
              ) : (
                <Table
                  columns={eventColumns}
                  dataSource={events.events}
                  rowKey="id"
                  loading={eventsLoading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} events`,
                  }}
                />
              )}
            </Card>
          </>
        )}
      </Space>
    </div>
  )
}

export default SystemPage
