import { useState } from 'react'
import { Layout as AntLayout } from 'antd'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const { Content } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />
      <AntLayout>
        <Header collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: '#1f1f1f',
            borderRadius: '8px',
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
