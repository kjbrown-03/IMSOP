import AdminLayout from '../../components/layout/AdminLayout'
import AdminUserManager from '../../components/admin/AdminUserManager'

export default function AdminCoordinateurs() {
  return (
    <AdminLayout>
      <AdminUserManager role="COORDINATEUR" />
    </AdminLayout>
  )
}
