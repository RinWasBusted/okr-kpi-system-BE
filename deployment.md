# Deploy BE

## Tổng quan tự động deploy BE khi push lên nhánh main.
- Tự động cập nhật code BE mới.
    - Github action tự chạy lệnh build để đảm bảo code BE không gặp lỗi.
    - Github action tự tạo docker image version mới và push lên docker hub. (Dùng Docker Layer Caching và multi-stage build để tăng tốc độ build image
    - Github action tự vào VPS để pull image version mới nhất về.
- Tự động cập nhật file docker-compose.yml.
    - Github action tự động copy riêng file docker-compose.yml qua VPS.
- Tự động cập nhật các biến môi trường trong file .env
    - Dùng Github CLI copy riêng file .env qua VPS
- Tự động dùng docker swarm để cập nhật và chạy code mới.
    - Github action tự chạy lệnh cập nhật code BE bằng docker swarm.


## Các lệnh cần thiết

Lệnh copy .env vào github secret: `gh secret set BE_ENV < .env.production` (Nếu chưa đăng nhập thì chạy `gh auth login` )

export $(grep -v '^#' .env | xargs) && \docker stack deploy --with-registry-auth -c docker-compose.yml okr_kpi_system_server


scp .env.production okready@157.66.46.72:~/okr-kpi-system/okr-kpi-system-be/.env 