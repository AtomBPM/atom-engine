import { Layout, Button, Space, Typography } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { ServerSelector } from '../ServerSelector/ServerSelector'

const { Header: AntHeader } = Layout
const { Title } = Typography

interface HeaderProps {
  collapsed: boolean
  onToggle: () => void
}

export const Header = ({ collapsed, onToggle }: HeaderProps) => {
  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: '#141414',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #303030',
      }}
    >
      <Space>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{
            fontSize: '16px',
            width: 64,
            height: 64,
          }}
        />
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          ATOM UI Core
        </Title>
      </Space>
      
      <ServerSelector />
    </AntHeader>
  )
}
