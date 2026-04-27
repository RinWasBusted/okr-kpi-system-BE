** Việc thực hiện lọc dữ liệu giữa các company đã được thực hiện tự động dưới database bằng RLS **

** User có role là ADMIN_COMPANY được toàn quyền xem, thêm, xóa, sửa tất cả dữ liệu. **

# Định nghĩa
- User phân cấp theo Unit mà nó thuộc về, nếu User A thuộc unit có cấp cao hơn và cùng nhánh với unit của User B thì User A là cấp trên của User B.
- Một Unit có thể có 1 user làm Manager.

# User
- Xem: Mọi người.
- Thêm, sửa, xóa: Chỉ có ADMIN_COMPANY.
- Lưu ý: Không thể sửa hay xóa một ADMIN_COMPANY.

# Unit
- Xem: Mọi người.
- Thêm, xóa, sửa: Chỉ có ADMIN_COMPANY

# OKR
- Xem: Tùy theo visibility của OKR đó:
    - PUBLIC: tất cả User trong công ty cũng có thể xem
    - INTERNAL: Chỉ có các User thuộc các Unit trong cùng nhánh Unit sỡ hữu OKR đó (là Unit đó, Unit cha hoặc các Unit con của Unit đó).
    - PRIVATE: Chỉ các User thuộc các Unit cấp trên và User sỡ hữu OKR đó (Nếu phân công user) hoặc User trực tiếp thuộc Unit đó (Nếu không phân công User).
- Thêm, sửa, xóa: Nếu OKR đó thuộc Unit (owner = null) thì chỉ có manager của Unit đó hoặc các User cấp cao hơn mới được sửa, những chỉnh sửa của User cấp cao hơn sẽ được áp dụng trực tiếp, còn là manager của unit đó thì phải tạo draft, gửi lên để user cấp trên duyệt (pending) rồi mới vào trạng thái active. Còn nếu OKR đó thuộc về user thì user đó cũng có quyền chỉnh sửa và đề xuất, còn manager của unit đó và các user cấp cao hơn sẽ có quyền phê duyệt. 
- Checkin các Key Result: Nếu OKR thuộc Unit đó thì các user của unit được checkin, nếu OKR phân công cho user thì chỉ user đó checkin. 
- Tạo feedback: Bất kì ai xem được cũng đều có thể tạo feedback.

# KPI Dictionaries
- Xem: Mọi người.
- Thêm, xóa, sửa: Mỗi KPI dictionary sẽ thuộc một unit, chỉ có manager của unit đó hoặc các user thuộc unit cấp trên mới có quyền.

# KPI Assignment
- Xem: Tương tự phần Xem của OKR.
- Thêm, sửa, xóa: User cấp trên toàn quyền thêm, sửa và xóa các KPI của unit và user cấp dưới.
- Checkin KPI: Các user thuộc unit đó (nếu là KPI của unit) hoặc các user được phân công cho KPI đó (nếu là KPI cá nhân).

# Cycle
- Xem: Mọi người
- Thêm, xóa, sửa: Admin Company