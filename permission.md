** Việc thực hiện lọc dữ liệu giữa các company đã được thực hiện tự động dưới database bằng RLS **

** User có role là ADMIN_COMPANY được toàn quyền xem, thêm, xóa, sửa tất cả dữ liệu. **

# Định nghĩa
- User phân cấp theo Unit mà nó thuộc về, nếu User A thuộc unit có cấp cao hơn unit của User B thì User A là cấp trên của User B 

# Unit
- Xem: All
- Thêm, xóa, sửa: Chỉ có ADMIN_COMPANY

# OKR
- Xem: Tùy theo visibility của OKR đó:
    - PUBLIC: tất cả User trong công ty cũng có thể xem
    - INTERNAL: Chỉ có các User thuộc các Unit trong cùng nhánh Unit sỡ hữu OKR đó (là Unit đó, Unit cha hoặc các Unit con của Unit đó).
    - PRIVATE: Chỉ các User thuộc các Unit cấp trên và User sỡ hữu OKR đó.
- Thêm, sửa: Nếu OKR đó thuộc Unit (owner = null) thì chỉ có manager của Unit đó hoặc các User cấp cao hơn mới được sửa, những chỉnh sửa của User cấp cao hơn sẽ được áp dụng trực tiếp, còn là manager thì phải tạo draft, gửi lên để user cấp trên duyệt (pending) rồi mới vào trạng thái active. 
- Xóa: Nếu là draft thì user manager của Unit được gửi yêu cầu xóa cho User cấp trên, được approve như khi tạo thì mới xóa được, còn nếu là user cấp trên xóa thì không cần yêu cầu user nào khác.

# KPI
- Xem: Tương tự phần Xem của OKR.
- Thêm, sửa, xóa: User cấp trên toàn quyền thêm, sửa và xóa các KPI của unit và user cấp dưới.