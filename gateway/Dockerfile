# ---- Build Stage ----
FROM gradle:8.5-jdk21 AS build

# 루트 코드 복사
WORKDIR /app
COPY . .

# 루트에서 Gradle 빌드 실행
RUN chmod +x gradlew || true
RUN ./gradlew :gateway:clean :gateway:build -x test --no-daemon

# ---- Runtime Stage ----
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/gateway/build/libs/*.jar ./
RUN find . -name "*.jar" ! -name "*-plain.jar" -exec mv {} app.jar \;

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
