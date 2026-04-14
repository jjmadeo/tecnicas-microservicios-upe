cmake_minimum_required(VERSION 3.10)
project(card-service C)

set(CMAKE_C_STANDARD 99)

find_package(PkgConfig REQUIRED)
pkg_check_modules(RABBITMQ REQUIRED librabbitmq)

add_executable(card-service src/main.c)

target_include_directories(card-service PRIVATE ${RABBITMQ_INCLUDE_DIRS})
target_link_libraries(card-service ${RABBITMQ_LIBRARIES})
target_compile_options(card-service PRIVATE ${RABBITMQ_CFLAGS_OTHER})
