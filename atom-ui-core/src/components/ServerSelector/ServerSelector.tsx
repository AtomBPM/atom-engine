import { Select, Space, Tag } from 'antd'
import { CloudServerOutlined } from '@ant-design/icons'
import { useServerStore } from '../../store/serverStore'

export const ServerSelector = () => {
  const { servers, currentServerId, setCurrentServer } = useServerStore()
  const currentServer = useServerStore(state => state.getCurrentServer())

  const handleChange = (serverId: string) => {
    setCurrentServer(serverId)
  }

  return (
    <Space>
      <Tag color="blue" icon={<CloudServerOutlined />}>
        {currentServer?.name || 'No Server'}
      </Tag>
      <Select
        value={currentServerId}
        onChange={handleChange}
        style={{ width: 200 }}
        options={servers.map(server => ({
          value: server.id,
          label: server.name,
        }))}
      />
    </Space>
  )
}
