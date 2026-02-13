import { Card, Row, Col, Statistic, Typography, Space, Button, Spin } from 'antd'
import {
  DatabaseOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useApi } from '../../hooks/useApi'
import * as storageApi from '../../api/endpoints/storage'

const { Title, Text } = Typography

const StoragePage = () => {
  const { data: status, loading: statusLoading, refetch: refetchStatus } = useApi(
    storageApi.getStorageStatus,
    { immediate: true }
  )
  
  const { data: info, loading: infoLoading, refetch: refetchInfo } = useApi(
    storageApi.getStorageInfo,
    { immediate: true }
  )

  const handleRefresh = () => {
    refetchStatus()
    refetchInfo()
  }

  const loading = statusLoading || infoLoading

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Storage</Title>
            <Text type="secondary">Storage status and information</Text>
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
            {/* Storage Status */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Card>
                  <Statistic
                    title="Health"
                    value={status?.is_healthy ? 'Healthy' : 'Unhealthy'}
                    valueStyle={{ 
                      color: status?.is_healthy ? '#3f8600' : '#cf1322' 
                    }}
                    prefix={status?.is_healthy ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card>
                  <Statistic
                    title="Status"
                    value={status?.status || 'Unknown'}
                    prefix={<DatabaseOutlined />}
                    valueStyle={{ 
                      color: status?.status === 'ready' ? '#3f8600' : '#cf1322' 
                    }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card>
                  <Statistic
                    title="Uptime"
                    value={status?.uptime_seconds || 0}
                    suffix="sec"
                  />
                </Card>
              </Col>
            </Row>

            {/* Storage Information */}
            <Card title="Storage Information">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card type="inner" title="Storage Size">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Statistic
                        title="Used"
                        value={formatBytes(info?.used_size_bytes || 0)}
                      />
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card type="inner" title="Database Details">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text type="secondary">Total Keys: </Text>
                        <Text strong>{info?.total_keys || 0}</Text>
                      </div>
                      <div>
                        <Text type="secondary">Database Path: </Text>
                        <Text code>{info?.database_path}</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Card>

            {/* Storage Statistics */}
            {info?.statistics && Object.keys(info.statistics).length > 0 && (
              <Card title="Storage Statistics">
                <Row gutter={[16, 16]}>
                  {Object.entries(info.statistics)
                    .filter(([key, value]) => value !== '0' && value !== '')
                    .map(([key, value]) => (
                      <Col key={key} xs={24} sm={12} md={8} lg={6}>
                        <Statistic
                          title={key.replace(/_/g, ' ').toUpperCase()}
                          value={value}
                        />
                      </Col>
                    ))}
                </Row>
              </Card>
            )}
          </>
        )}
      </Space>
    </div>
  )
}

export default StoragePage
