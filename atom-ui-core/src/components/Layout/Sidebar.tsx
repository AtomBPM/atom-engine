import { Layout, Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  MessageOutlined,
  FunctionOutlined,
  WarningOutlined,
  SettingOutlined,
} from '@ant-design/icons'

const { Sider } = Layout

interface SidebarProps {
  collapsed: boolean
}

export const Sidebar = ({ collapsed }: SidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/system',
      icon: <SettingOutlined />,
      label: 'System',
    },
    {
      key: '/storage',
      icon: <DatabaseOutlined />,
      label: 'Storage',
    },
    {
      key: '/bpmn',
      icon: <FileTextOutlined />,
      label: 'BPMN Parser',
    },
    {
      key: '/processes',
      icon: <BranchesOutlined />,
      label: 'Processes',
    },
    {
      key: '/tokens',
      icon: <ThunderboltOutlined />,
      label: 'Tokens',
    },
    {
      key: '/timers',
      icon: <ClockCircleOutlined />,
      label: 'Timers',
    },
    {
      key: '/jobs',
      icon: <CodeOutlined />,
      label: 'Jobs',
    },
    {
      key: '/messages',
      icon: <MessageOutlined />,
      label: 'Messages',
    },
    {
      key: '/expressions',
      icon: <FunctionOutlined />,
      label: 'Expressions',
    },
    {
      key: '/incidents',
      icon: <WarningOutlined />,
      label: 'Incidents',
    },
  ]

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      style={{
        background: '#141414',
        borderRight: '1px solid #303030',
      }}
    >
      <div
        style={{
          height: 32,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#1890ff',
        }}
      >
        {!collapsed && 'ATOM'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ background: '#141414' }}
      />
    </Sider>
  )
}
