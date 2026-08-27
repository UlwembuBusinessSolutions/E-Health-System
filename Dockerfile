# --- Build stage ---
# Maven image, not a bare JDK + separately installed Maven — matches this
# repo's own assumption (mvn, no committed mvnw wrapper yet).
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# pom.xml copied and dependencies resolved before the source — Docker's
# layer cache then only re-runs the (slow) dependency download when pom.xml
# itself changes, not on every source edit.
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# --- Runtime stage ---
# JRE, not the JDK build image above — no compiler needed to run a jar,
# smaller final image.
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005", "-jar", "app.jar"]
#ENTRYPOINT ["java", "-jar", "app.jar"]
