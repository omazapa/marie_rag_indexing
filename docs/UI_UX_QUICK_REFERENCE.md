# UI/UX Quick Reference Guide

## 🎨 Component Usage Guide

### PageHeader
Use for every page to create consistent headers.

```tsx
import { PageHeader } from '@/components/PageHeader';
import { Database } from 'lucide-react';

<PageHeader
  title="Page Title"
  description="Brief description"
  icon={Database}
  gradient  // optional: gradient background on icon
  breadcrumbs={[
    { title: <Link href="/">Home</Link>, href: '/' },
    { title: 'Current Page' }
  ]}
  extra={<Button>Action</Button>}
/>
```

### StatCard
Use for displaying metrics on dashboards.

```tsx
import { StatCard } from '@/components/StatCard';
import { Database } from 'lucide-react';

<StatCard
  title="Metric Name"
  value={100}
  icon={Database}
  iconColor="text-blue-500"
  iconBg="bg-blue-50"
  progress={75}  // optional
  trend="up"  // optional: up/down
  trendValue="+12%"  // optional
  onClick={() => router.push('/page')}  // optional
  loading={isLoading}
/>
```

### ActionCard
Use for quick action items.

```tsx
import { ActionCard } from '@/components/ActionCard';
import { Plus } from 'lucide-react';

<ActionCard
  icon={Plus}
  title="Action Title"
  description="What this action does"
  onClick={handleClick}
  iconColor="text-blue-600"
  iconBg="bg-blue-50"
/>
```

### StatusIndicator
Use for showing status with visual feedback.

```tsx
import { StatusIndicator } from '@/components/StatusIndicator';

<StatusIndicator
  status="success"  // success | error | warning | info | processing
  text="Completed"
  showIcon
  pulse  // optional: adds pulse animation
/>
```

### TableCard
Use instead of standalone Table components.

```tsx
import { TableCard } from '@/components/TableCard';
import { Database } from 'lucide-react';

<TableCard
  title="Table Title"
  icon={Database}
  description="Table description"  // optional
  extra={<Button>Action</Button>}  // optional
  dataSource={data}
  columns={columns}
  loading={isLoading}
/>
```

### EnhancedModal
Use instead of standard Modal.

```tsx
import { EnhancedModal } from '@/components/EnhancedModal';
import { Plus } from 'lucide-react';

<EnhancedModal
  icon={Plus}
  title="Modal Title"
  iconColor="text-blue-600"
  iconBg="bg-blue-50"
  open={isOpen}
  onOk={handleOk}
  onCancel={handleCancel}
>
  {content}
</EnhancedModal>
```

### InfoTooltip
Use for contextual help.

```tsx
import { InfoTooltip } from '@/components/InfoTooltip';

<Space>
  <Text>Label</Text>
  <InfoTooltip
    title="Label"
    content="Helpful description"
    icon="info"  // info | help
  />
</Space>
```

### ProgressSteps
Use for multi-step processes.

```tsx
import { ProgressSteps } from '@/components/ProgressSteps';

<ProgressSteps
  current={1}
  status="process"  // wait | process | finish | error
  steps={[
    { title: 'Step 1', description: 'Description' },
    { title: 'Step 2', description: 'Description' },
    { title: 'Step 3', description: 'Description' }
  ]}
/>
```

### EmptyState
Use when tables or lists have no data.

```tsx
import { EmptyState } from '@/components/EmptyState';
import { Database } from 'lucide-react';

<EmptyState
  icon={Database}
  title="No data sources"
  description="Get started by adding your first data source"
  actionLabel="Add Data Source"
  onAction={handleAdd}
/>
```

## 🎭 Animation Classes

### Fade In
```tsx
<div className="fade-in">Content</div>
```

### Slide In Right
```tsx
<div className="slide-in-right">Content</div>
```

### Card Interactive (Hover Effect)
```tsx
<Card className="card-interactive">Content</Card>
```

### Status Dot
```tsx
<span className="status-dot success" />
<span className="status-dot error" />
<span className="status-dot warning" />
<span className="status-dot info" />
```

### Glass Effect
```tsx
<div className="glass p-4 rounded-lg">Content</div>
```

### Gradient Backgrounds
```tsx
<div className="gradient-primary p-4 rounded-lg">Content</div>
<div className="gradient-success p-4 rounded-lg">Content</div>
<div className="gradient-info p-4 rounded-lg">Content</div>
```

## 🎨 Color System

### Icon Colors (Tailwind)
```tsx
className="text-blue-500"    // Info
className="text-green-500"   // Success
className="text-purple-500"  // Primary
className="text-orange-500"  // Warning
className="text-red-500"     // Error
className="text-emerald-500" // Health
```

### Background Colors
```tsx
className="bg-blue-50"    // Info background
className="bg-green-50"   // Success background
className="bg-purple-50"  // Primary background
className="bg-orange-50"  // Warning background
className="bg-red-50"     // Error background
className="bg-emerald-50" // Health background
```

### Status Colors (Ant Design)
```tsx
<Tag color="success">Success</Tag>
<Tag color="error">Error</Tag>
<Tag color="warning">Warning</Tag>
<Tag color="processing">Processing</Tag>
<Tag color="default">Default</Tag>
```

## 📐 Spacing System

### Ant Design Grid
```tsx
<Row gutter={[16, 16]}>  // Horizontal, Vertical
  <Col xs={24} sm={12} lg={6}>Content</Col>
</Row>
```

### Breakpoints
- `xs`: < 576px (Mobile)
- `sm`: ≥ 576px (Tablet)
- `md`: ≥ 768px
- `lg`: ≥ 992px (Desktop)
- `xl`: ≥ 1200px
- `xxl`: ≥ 1600px

### Space Component
```tsx
<Space size="small">     // 8px
<Space size="middle">    // 16px (default)
<Space size="large">     // 24px
<Space direction="vertical">
```

## 🖱️ Interactive States

### Hover Effect on Cards
```tsx
<Card className="shadow-sm hover:shadow-md transition-all duration-250 hover:-translate-y-1">
  Content
</Card>
```

### Clickable Cards
```tsx
<Card
  className="cursor-pointer transition-all duration-250 hover:shadow-md"
  onClick={handleClick}
>
  Content
</Card>
```

### Hover on Table Rows
```tsx
<Flex className="hover:bg-gray-50 px-3 rounded-lg transition-colors">
  Content
</Flex>
```

## 🔄 Loading States

### Skeleton Loading
```tsx
import { Skeleton } from 'antd';

{isLoading ? (
  <Skeleton active paragraph={{ rows: 2 }} />
) : (
  <Content />
)}
```

### Button Loading
```tsx
<Button
  type="primary"
  loading={isLoading}
  onClick={handleClick}
>
  Submit
</Button>
```

### Spin Loading
```tsx
import { Spin } from 'antd';

<Spin spinning={isLoading}>
  <Content />
</Spin>
```

## 📱 Responsive Design

### Hide on Mobile
```tsx
<div className="hide-mobile">Desktop only</div>
```

### Hide on Desktop
```tsx
<div className="hide-desktop">Mobile only</div>
```

### Responsive Columns
```tsx
<Col xs={24} sm={12} lg={8} xl={6}>
  // Full width mobile
  // Half width tablet
  // Third width desktop
  // Quarter width large desktop
</Col>
```

## ✨ Best Practices

### DO ✅
```tsx
// Use consistent spacing
<Space size="middle">

// Apply animations
<div className="fade-in">

// Provide loading states
{isLoading ? <Skeleton /> : <Content />}

// Use semantic colors
<StatCard iconColor="text-blue-500" iconBg="bg-blue-50" />

// Add hover effects
<Card className="hover:shadow-md transition-all">

// Use StatusIndicator for status
<StatusIndicator status="success" text="Active" />

// Include empty states
{data.length === 0 && <EmptyState />}

// Add tooltips for help
<InfoTooltip title="Help" content="Description" />
```

### DON'T ❌
```tsx
// Don't use inline styles (use Tailwind/CSS)
<div style={{ marginTop: 16 }}>  ❌

// Don't mix transition durations
<div className="transition-all duration-100">  ❌
<div className="transition-all duration-500">  ❌

// Don't forget hover states
<Card onClick={...}>  ❌  // Missing hover effect

// Don't use plain tags for status
<Tag>Active</Tag>  ❌  // Use StatusIndicator

// Don't skip loading states
{data && <Table />}  ❌  // No loading indication

// Don't use custom colors without variables
<div className="text-[#123456]">  ❌  // Use semantic colors

// Don't forget empty states
{data.length === 0 && <p>No data</p>}  ❌  // Use EmptyState

// Don't create one-off components
<div>Custom card</div>  ❌  // Use existing components
```

## 📝 Code Patterns

### Standard Page Layout
```tsx
export default function MyPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery(...);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Page Title"
        description="Description"
        icon={Icon}
        breadcrumbs={[...]}
        extra={<Button>Action</Button>}
      />

      {/* Stats Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard {...} />
        </Col>
        {/* More stats */}
      </Row>

      {/* Main Content */}
      <TableCard
        title="Data"
        icon={Icon}
        dataSource={data}
        columns={columns}
        loading={isLoading}
      />
    </div>
  );
}
```

### Standard Modal Pattern
```tsx
const [isOpen, setIsOpen] = useState(false);
const [form] = Form.useForm();

<EnhancedModal
  icon={Plus}
  title="Add Item"
  open={isOpen}
  onCancel={() => setIsOpen(false)}
  onOk={() => form.submit()}
>
  <Form form={form} onFinish={handleSubmit}>
    {/* Form fields */}
  </Form>
</EnhancedModal>
```

### Standard Table with Actions
```tsx
const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => (
      <StatusIndicator status={status} text={status} />
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    align: 'right',
    render: (_, record) => (
      <Space>
        <Button
          type="primary"
          size="small"
          icon={<Play size={14} />}
          onClick={() => handleRun(record)}
        >
          Run
        </Button>
        <Button
          type="text"
          size="small"
          icon={<Settings size={14} />}
          onClick={() => handleEdit(record)}
        />
        <Button
          type="text"
          size="small"
          danger
          icon={<Trash2 size={14} />}
          onClick={() => handleDelete(record)}
        />
      </Space>
    ),
  },
];
```

## 🚀 Performance Tips

1. **Use React.memo for expensive components**
```tsx
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});
```

2. **Lazy load heavy components**
```tsx
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton active />,
});
```

3. **Debounce search inputs**
```tsx
import { useDebouncedCallback } from 'use-debounce';

const handleSearch = useDebouncedCallback((value) => {
  // Search logic
}, 300);
```

4. **Use React Query for caching**
```tsx
const { data } = useQuery({
  queryKey: ['key'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000,  // 5 minutes
});
```

---

**Quick Start**: Import component → Copy example → Customize colors/icons → Done! 🎉
