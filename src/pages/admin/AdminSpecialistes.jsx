import AdminLayout from '../../components/layout/AdminLayout'
import AdminUserManager from '../../components/admin/AdminUserManager'

export default function AdminSpecialistes() {
  return (
    <AdminLayout>
      <AdminUserManager role="SPECIALISTE" />
    </AdminLayout>
  )
}
