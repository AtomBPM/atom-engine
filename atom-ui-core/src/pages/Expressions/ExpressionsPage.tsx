import { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Form,
  Input,
  Tabs,
  Tag,
  Table,
  Alert,
} from 'antd'
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useApi, useMutation } from '../../hooks/useApi'
import * as expressionsApi from '../../api/endpoints/expressions'

const { Title, Text } = Typography
const { TextArea } = Input

const ExpressionsPage = () => {
  const [evaluateForm] = Form.useForm()
  const [conditionForm] = Form.useForm()
  const [parseForm] = Form.useForm()
  const [validateForm] = Form.useForm()
  const [extractForm] = Form.useForm()
  const [result, setResult] = useState<any>(null)

  const { data: functions, loading: functionsLoading } = useApi(
    expressionsApi.getSupportedFunctions,
    { immediate: true }
  )

  const { mutate: evaluate, loading: evaluating } = useMutation(expressionsApi.evaluateExpression, {
    onSuccess: (data) => setResult(data)
  })

  const { mutate: evaluateCondition, loading: evaluatingCondition } = useMutation(
    expressionsApi.evaluateCondition,
    { onSuccess: (data) => setResult(data) }
  )

  const { mutate: parse, loading: parsing } = useMutation(expressionsApi.parseExpression, {
    onSuccess: (data) => setResult(data)
  })

  const { mutate: validate, loading: validating } = useMutation(expressionsApi.validateExpression, {
    onSuccess: (data) => setResult(data)
  })

  const { mutate: extractVars, loading: extracting } = useMutation(expressionsApi.extractVariables, {
    onSuccess: (data) => setResult(data)
  })

  const handleEvaluate = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        setResult({ error: 'Invalid JSON in variables' })
        return
      }
    }
    await evaluate({ expression: values.expression, variables })
  }

  const handleEvaluateCondition = async (values: any) => {
    let variables = {}
    if (values.variables) {
      try {
        variables = JSON.parse(values.variables)
      } catch (e) {
        setResult({ error: 'Invalid JSON in variables' })
        return
      }
    }
    await evaluateCondition({ condition: values.condition, variables })
  }

  const functionColumns = [
    {
      title: 'Function',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Tag color="blue">{name}()</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Parameters',
      dataIndex: 'parameters',
      key: 'parameters',
      render: (params: string[]) => params?.join(', ') || '-',
    },
    {
      title: 'Return Type',
      dataIndex: 'return_type',
      key: 'return_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Expressions</Title>
          <Text type="secondary">Expression evaluation, validation, and testing</Text>
        </div>

        <Card>
          <Tabs
            items={[
              {
                key: 'evaluate',
                label: 'Evaluate Expression',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form form={evaluateForm} layout="vertical" onFinish={handleEvaluate}>
                      <Form.Item name="expression" label="Expression" rules={[{ required: true }]}>
                        <Input placeholder="x + y * 2" />
                      </Form.Item>
                      <Form.Item name="variables" label="Variables (JSON)">
                        <TextArea rows={4} placeholder='{"x": 10, "y": 5}' />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={evaluating}>
                        Evaluate
                      </Button>
                    </Form>
                    {result && (
                      <Card title="Result" type="inner">
                        <pre style={{ background: '#1f1f1f', padding: '12px', borderRadius: '4px' }}>
                          <code>{JSON.stringify(result, null, 2)}</code>
                        </pre>
                      </Card>
                    )}
                  </Space>
                ),
              },
              {
                key: 'condition',
                label: 'Evaluate Condition',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form form={conditionForm} layout="vertical" onFinish={handleEvaluateCondition}>
                      <Form.Item name="condition" label="Condition" rules={[{ required: true }]}>
                        <Input placeholder="age >= 18 and status == 'active'" />
                      </Form.Item>
                      <Form.Item name="variables" label="Variables (JSON)">
                        <TextArea rows={4} placeholder='{"age": 25, "status": "active"}' />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={evaluatingCondition}>
                        Evaluate Condition
                      </Button>
                    </Form>
                    {result && (
                      <Card title="Result" type="inner">
                        <pre style={{ background: '#1f1f1f', padding: '12px', borderRadius: '4px' }}>
                          <code>{JSON.stringify(result, null, 2)}</code>
                        </pre>
                      </Card>
                    )}
                  </Space>
                ),
              },
              {
                key: 'parse',
                label: 'Parse Expression',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form form={parseForm} layout="vertical" onFinish={(v) => parse(v)}>
                      <Form.Item name="expression" label="Expression" rules={[{ required: true }]}>
                        <Input placeholder="sum(items[price > 100].price)" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={parsing}>
                        Parse to AST
                      </Button>
                    </Form>
                    {result && (
                      <Card title="AST Result" type="inner">
                        <pre style={{ background: '#1f1f1f', padding: '12px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
                          <code>{JSON.stringify(result, null, 2)}</code>
                        </pre>
                      </Card>
                    )}
                  </Space>
                ),
              },
              {
                key: 'validate',
                label: 'Validate',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form form={validateForm} layout="vertical" onFinish={(v) => validate(v)}>
                      <Form.Item name="expression" label="Expression" rules={[{ required: true }]}>
                        <Input placeholder="upper(user.name)" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={validating}>
                        Validate
                      </Button>
                    </Form>
                    {result && (
                      <Alert
                        message={result.valid ? 'Valid Expression' : 'Invalid Expression'}
                        description={result.error || 'Expression is syntactically correct'}
                        type={result.valid ? 'success' : 'error'}
                        showIcon
                      />
                    )}
                  </Space>
                ),
              },
              {
                key: 'extract',
                label: 'Extract Variables',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form form={extractForm} layout="vertical" onFinish={(v) => extractVars(v)}>
                      <Form.Item name="expression" label="Expression" rules={[{ required: true }]}>
                        <Input placeholder="user.name + ' ' + user.age" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={extracting}>
                        Extract Variables
                      </Button>
                    </Form>
                    {result && Array.isArray(result) && (
                      <Card title="Extracted Variables" type="inner">
                        <Space wrap>
                          {result.map((variable: string) => (
                            <Tag key={variable} color="green">{variable}</Tag>
                          ))}
                        </Space>
                      </Card>
                    )}
                  </Space>
                ),
              },
              {
                key: 'functions',
                label: 'Supported Functions',
                children: (
                  <Table
                    columns={functionColumns}
                    dataSource={functions || []}
                    rowKey="name"
                    loading={functionsLoading}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}

export default ExpressionsPage
